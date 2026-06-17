package cloud.cinemood.app.ui.screens.decide

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.*
import cloud.cinemood.app.ui.theme.CinemoodTheme
import kotlinx.coroutines.launch

// ── Mode + swipe state machines ───────────────────────────────────────────────

sealed interface DecideMode {
    data object Landing : DecideMode
    data object Mood    : DecideMode
    data object Compare : DecideMode
    data object Swipe   : DecideMode
}

sealed interface SwipePhase {
    data object Idle    : SwipePhase
    data object Loading : SwipePhase
    data class Questions(
        val questions:    List<SwipeQuestion>,
        val candidateIds: List<Int>,
        val index:        Int,
    ) : SwipePhase
    data object Picking : SwipePhase
    data class Result(val response: DecidePickResponse) : SwipePhase
    data class Error(val message: String) : SwipePhase
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

class DecideViewModel(private val api: CinemoodApi) : ViewModel() {

    var mode by mutableStateOf<DecideMode>(DecideMode.Landing)

    // shared watchlist (for compare + candidate IDs)
    var watchlist    by mutableStateOf<List<WatchlistItem>>(emptyList())
    var watchlistErr by mutableStateOf<String?>(null)

    // Mood
    var mood        by mutableStateOf("")
    var moodStatus  by mutableStateOf<String?>(null)
    var moodLoading by mutableStateOf(false)
    var moodError   by mutableStateOf<String?>(null)
    var moodResult  by mutableStateOf<RecommendResponse?>(null)

    // Compare
    val selectedIds = mutableStateListOf<Int>()
    var compareLoading by mutableStateOf(false)
    var compareError   by mutableStateOf<String?>(null)
    var compareResult  by mutableStateOf<CompareResponse?>(null)

    // Swipe
    var swipePhase by mutableStateOf<SwipePhase>(SwipePhase.Idle)
    private val answers = mutableListOf<SwipeAnswer>()

    init { loadWatchlist() }

    fun loadWatchlist() {
        viewModelScope.launch {
            api.listWatchlist(limit = 500).fold(
                onSuccess = { watchlist = it },
                onFailure = { watchlistErr = it.message },
            )
        }
    }

    // ── Mood ──────────────────────────────────────────────────────────────────

    fun runMood() {
        viewModelScope.launch {
            moodLoading = true
            moodError   = null
            api.recommend(mood.trim(), status = moodStatus, limit = 8).fold(
                onSuccess = { moodResult = it },
                onFailure = { moodError  = it.message },
            )
            moodLoading = false
        }
    }

    fun resetMood() {
        mood = ""; moodStatus = null; moodResult = null; moodError = null
    }

    // ── Compare ───────────────────────────────────────────────────────────────

    fun toggleSelect(id: Int) {
        if (selectedIds.contains(id)) selectedIds.remove(id) else selectedIds.add(id)
    }

    fun runCompare() {
        viewModelScope.launch {
            compareLoading = true
            compareError   = null
            api.compare(selectedIds.toList()).fold(
                onSuccess = { compareResult = it },
                onFailure = { compareError  = it.message },
            )
            compareLoading = false
        }
    }

    fun resetCompare() {
        selectedIds.clear(); compareResult = null; compareError = null
    }

    // ── Swipe ─────────────────────────────────────────────────────────────────

    fun startSwipe() {
        viewModelScope.launch {
            swipePhase = SwipePhase.Loading
            answers.clear()
            api.decideQuestions(count = 5).fold(
                onSuccess = { resp ->
                    swipePhase = SwipePhase.Questions(resp.questions, resp.candidateIds, 0)
                },
                onFailure = { swipePhase = SwipePhase.Error(it.message ?: "Failed to load questions") },
            )
        }
    }

    fun answer(questionId: String, optionId: String) {
        answers += SwipeAnswer(questionId, optionId)
        val p = swipePhase as? SwipePhase.Questions ?: return
        val next = p.index + 1
        if (next >= p.questions.size) {
            pick(p.candidateIds)
        } else {
            swipePhase = p.copy(index = next)
        }
    }

    private fun pick(candidateIds: List<Int>) {
        viewModelScope.launch {
            swipePhase = SwipePhase.Picking
            api.decidePick(candidateIds, answers.toList()).fold(
                onSuccess = { swipePhase = SwipePhase.Result(it) },
                onFailure = { swipePhase = SwipePhase.Error(it.message ?: "Could not pick a title") },
            )
        }
    }

    fun resetSwipe() {
        swipePhase = SwipePhase.Idle
        answers.clear()
    }
}

// ── Root Decide screen ────────────────────────────────────────────────────────

@Composable
fun DecideScreen(
    vm:          DecideViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    modifier:    Modifier = Modifier,
) {
    val reduced = cloud.cinemood.app.ui.util.rememberReducedMotion()

    AnimatedContent(
        targetState      = vm.mode,
        modifier         = modifier.fillMaxSize(),
        transitionSpec   = {
            if (reduced) fadeIn() togetherWith fadeOut()
            else fadeIn() togetherWith fadeOut()
        },
        label            = "decideMode",
    ) { mode ->
        when (mode) {
            is DecideMode.Landing -> DecideLanding(
                onSelectMood    = { vm.mode = DecideMode.Mood },
                onSelectCompare = { vm.mode = DecideMode.Compare },
                onSelectSwipe   = { vm.mode = DecideMode.Swipe; vm.startSwipe() },
            )
            is DecideMode.Mood    -> MoodPickerSection(
                vm          = vm,
                onItemClick = onItemClick,
                onBack      = { vm.resetMood(); vm.mode = DecideMode.Landing },
            )
            is DecideMode.Compare -> CompareSection(
                vm          = vm,
                onItemClick = onItemClick,
                onBack      = { vm.resetCompare(); vm.mode = DecideMode.Landing },
            )
            is DecideMode.Swipe   -> SwipeDeckSection(
                vm          = vm,
                onItemClick = onItemClick,
                onBack      = { vm.resetSwipe(); vm.mode = DecideMode.Landing },
            )
        }
    }
}

// ── Landing: 3-card hub ───────────────────────────────────────────────────────

@Composable
private fun DecideLanding(
    onSelectMood:    () -> Unit,
    onSelectCompare: () -> Unit,
    onSelectSwipe:   () -> Unit,
) {
    val colors = CinemoodTheme.colors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text  = "Decide",
            style = MaterialTheme.typography.headlineMedium.copy(color = colors.ink),
        )
        Text(
            text  = "What should you watch tonight?",
            style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
        )

        Spacer(modifier = Modifier.height(8.dp))

        DecideModeCard(
            icon        = Icons.Rounded.AutoAwesome,
            title       = "Mood picker",
            subtitle    = "Describe how you're feeling — get ranked suggestions.",
            onClick     = onSelectMood,
        )
        DecideModeCard(
            icon        = Icons.Rounded.Quiz,
            title       = "Q&A decider",
            subtitle    = "Answer 5 quick questions. Get one perfect pick.",
            onClick     = onSelectSwipe,
        )
        DecideModeCard(
            icon        = Icons.Rounded.GridView,
            title       = "Compare titles",
            subtitle    = "Select 2–6 titles from your library, then compare side by side.",
            onClick     = onSelectCompare,
        )
    }
}

@Composable
private fun DecideModeCard(
    icon:     ImageVector,
    title:    String,
    subtitle: String,
    onClick:  () -> Unit,
) {
    val colors = CinemoodTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(colors.paper2)
            .clickable(onClick = onClick)
            .padding(20.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        Box(
            modifier         = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(colors.accent.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = colors.accent, modifier = Modifier.size(22.dp))
        }
        Column(
            modifier            = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text  = title,
                style = MaterialTheme.typography.titleMedium.copy(
                    color      = colors.ink,
                    fontWeight = FontWeight.Bold,
                ),
            )
            Text(
                text  = subtitle,
                style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
            )
        }
        Icon(
            Icons.Rounded.ChevronRight,
            null,
            tint     = colors.faint,
            modifier = Modifier.size(20.dp),
        )
    }
}
