package cloud.cinemood.app.ui.screens

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.CastMember
import cloud.cinemood.app.data.model.ParsedQuery
import cloud.cinemood.app.data.model.Title
import cloud.cinemood.app.data.model.TmdbResult
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.AiSearchIcon
import cloud.cinemood.app.ui.theme.CinemoodTheme
import cloud.cinemood.app.ui.util.rememberReducedMotion
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private const val TMDB_POSTER = "https://image.tmdb.org/t/p/w185"

// ── Mode ──────────────────────────────────────────────────────────────────────

enum class AssistantMode { Discover, Library }

// ── State ─────────────────────────────────────────────────────────────────────

sealed interface AssistantState {
    data object Idle : AssistantState
    data class Listening(val interim: String = "") : AssistantState
    data class Thinking(val query: String) : AssistantState
    data class DiscoverResults(
        val parsed: ParsedQuery?,
        val results: List<TmdbResult>,
        val query: String,
    ) : AssistantState
    data class LibraryResults(
        val parsed: ParsedQuery?,
        val results: List<WatchlistItem>,
        val query: String,
    ) : AssistantState
    data class NoResults(val query: String, val mode: AssistantMode) : AssistantState
    data class Error(val message: String) : AssistantState
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

class AssistantViewModel(private val api: CinemoodApi) : ViewModel() {

    var state       by mutableStateOf<AssistantState>(AssistantState.Idle)
    var query       by mutableStateOf("")
    var addedIds    by mutableStateOf<Set<Int>>(emptySet())
        private set
    var removedIds  by mutableStateOf<Set<Int>>(emptySet())
        private set

    // Preview sheet state
    var previewItem  by mutableStateOf<TmdbResult?>(null)
    var previewTitle by mutableStateOf<Title?>(null)
    var previewLoading by mutableStateOf(false)

    // Private backing field to avoid JVM signature clash with setMode() (CLAUDE.md rule)
    private var _mode by mutableStateOf(AssistantMode.Discover)
    val mode: AssistantMode get() = _mode

    init {
        // Auto-search as the user types with 500 ms debounce
        viewModelScope.launch {
            snapshotFlow { query }
                .drop(1)
                .map { it.trim() }
                .distinctUntilChanged()
                .debounce(500L)
                .collect { trimmed -> if (trimmed.isNotBlank()) search(trimmed) }
        }
    }

    fun setMode(m: AssistantMode) {
        _mode = m
        val q = query.trim()
        if (q.isNotBlank()) search(q)
    }

    fun search(q: String) {
        val trimmed = q.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            state = AssistantState.Thinking(trimmed)
            when (mode) {
                AssistantMode.Discover -> {
                    api.discover(trimmed).fold(
                        onSuccess = { result ->
                            state = if (result.results.isEmpty())
                                AssistantState.NoResults(trimmed, mode)
                            else
                                AssistantState.DiscoverResults(result.parsed, result.results, trimmed)
                        },
                        onFailure = {
                            state = AssistantState.Error(it.message ?: "Discover failed")
                        },
                    )
                }
                AssistantMode.Library -> {
                    api.nlSearch(trimmed).fold(
                        onSuccess = { result ->
                            state = if (result.results.isEmpty())
                                AssistantState.NoResults(trimmed, mode)
                            else
                                AssistantState.LibraryResults(result.parsed, result.results, trimmed)
                        },
                        onFailure = {
                            state = AssistantState.Error(it.message ?: "Search failed")
                        },
                    )
                }
            }
        }
    }

    fun addToWatchlist(item: TmdbResult) {
        if (addedIds.contains(item.id)) return
        // Optimistic: show checkmark immediately
        addedIds = addedIds + item.id
        removedIds = removedIds - item.id
        viewModelScope.launch {
            api.addToWatchlist(item.id, item.type).onFailure {
                // Revert on failure
                addedIds = addedIds - item.id
            }
        }
    }

    fun removeFromWatchlist(item: TmdbResult) {
        if (removedIds.contains(item.id)) return
        removedIds = removedIds + item.id
        addedIds   = addedIds  - item.id
        viewModelScope.launch {
            api.removeFromWatchlist(item.id).onFailure {
                removedIds = removedIds - item.id
                addedIds   = addedIds   + item.id
            }
        }
    }

    fun openPreview(item: TmdbResult) {
        previewItem  = item
        previewTitle = null
        previewLoading = true
        viewModelScope.launch {
            api.getTitle(item.type, item.id).onSuccess { previewTitle = it }
            previewLoading = false
        }
    }

    fun closePreview() {
        previewItem    = null
        previewTitle   = null
        previewLoading = false
    }

    fun reset() {
        state          = AssistantState.Idle
        query          = ""
        addedIds       = emptySet()
        removedIds     = emptySet()
        previewItem    = null
        previewTitle   = null
        previewLoading = false
    }
}

// ── Root composable ────────────────────────────────────────────────────────────

@Composable
fun AssistantSheet(
    vm:          AssistantViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    onDismiss:   () -> Unit,
) {
    val colors  = CinemoodTheme.colors
    val context = LocalContext.current
    val reduced = rememberReducedMotion()

    // Voice launchers
    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val transcript = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
                ?: return@rememberLauncherForActivityResult
            vm.search(transcript)
        } else {
            // Cancelled — go back to Idle if we were Listening
            if (vm.state is AssistantState.Listening) vm.state = AssistantState.Idle
        }
    }
    val micPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchSpeech(context, speechLauncher, vm)
    }

    fun onMicTap() {
        val hasPerm = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (hasPerm) launchSpeech(context, speechLauncher, vm)
        else micPermLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    Dialog(
        onDismissRequest = {
            vm.reset()
            onDismiss()
        },
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows  = false,
        ),
    ) {
        Surface(
            modifier     = Modifier.fillMaxSize(),
            color        = colors.paper,
            contentColor = colors.ink,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
            ) {
                // ── Header ─────────────────────────────────────────────────
                AssistantHeader(
                    mode     = vm.mode,
                    onMode   = { vm.setMode(it) },
                    onClose  = { vm.reset(); onDismiss() },
                )

                HorizontalDivider(color = colors.rule, thickness = 0.5.dp)

                // ── Search field ───────────────────────────────────────────
                AssistantSearchField(
                    query     = vm.query,
                    onChange  = { vm.query = it },
                    onSearch  = { vm.search(vm.query) },
                    onMic     = { onMicTap() },
                    searching = vm.state is AssistantState.Thinking,
                )

                // ── Parsed chips ───────────────────────────────────────────
                val parsedToShow: ParsedQuery? = when (val s = vm.state) {
                    is AssistantState.DiscoverResults -> s.parsed
                    is AssistantState.LibraryResults  -> s.parsed
                    is AssistantState.NoResults       -> null
                    else -> null
                }
                AnimatedVisibility(
                    visible = parsedToShow != null,
                    enter   = if (reduced) fadeIn(tween(0)) else fadeIn() + expandVertically(),
                    exit    = if (reduced) fadeOut(tween(0)) else fadeOut() + shrinkVertically(),
                ) {
                    parsedToShow?.let { ParsedChipsRow(it) }
                }

                HorizontalDivider(color = colors.rule, thickness = 0.5.dp)

                // ── Content ────────────────────────────────────────────────
                when (val s = vm.state) {
                    is AssistantState.Idle -> {
                        IdleContent(
                            mode      = vm.mode,
                            onPrompt  = { vm.search(it) },
                        )
                    }
                    is AssistantState.Listening -> {
                        ListeningContent(interim = s.interim, reduced = reduced)
                    }
                    is AssistantState.Thinking -> {
                        ThinkingContent(reduced = reduced)
                    }
                    is AssistantState.DiscoverResults -> {
                        DiscoverResultsList(
                            results    = s.results,
                            addedIds   = vm.addedIds,
                            reduced    = reduced,
                            onAdd      = { vm.addToWatchlist(it) },
                            onRemove   = { vm.removeFromWatchlist(it) },
                            onOpen     = { vm.openPreview(it) },
                        )
                    }
                    is AssistantState.LibraryResults -> {
                        LibraryResultsList(
                            results   = s.results,
                            reduced   = reduced,
                            onOpen    = { item ->
                                vm.reset()
                                onItemClick(item)
                                onDismiss()
                            },
                        )
                    }
                    is AssistantState.NoResults -> {
                        NoResultsContent(
                            query    = s.query,
                            mode     = s.mode,
                            onSwitch = {
                                val other = if (s.mode == AssistantMode.Discover)
                                    AssistantMode.Library else AssistantMode.Discover
                                vm.setMode(other)
                            },
                        )
                    }
                    is AssistantState.Error -> {
                        ErrorContent(message = s.message)
                    }
                }
            }
        }
    }

    // Preview sheet — shown when user taps a discover result card
    vm.previewItem?.let { item ->
        TmdbPreviewSheet(
            item     = item,
            title    = vm.previewTitle,
            loading  = vm.previewLoading,
            added    = vm.addedIds.contains(item.id),
            onAdd    = { vm.addToWatchlist(item) },
            onRemove = { vm.removeFromWatchlist(item) },
            onDismiss = { vm.closePreview() },
        )
    }
}

// ── Header ────────────────────────────────────────────────────────────────────

@Composable
private fun AssistantHeader(
    mode:    AssistantMode,
    onMode:  (AssistantMode) -> Unit,
    onClose: () -> Unit,
) {
    val colors = CinemoodTheme.colors
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        AiSearchIcon(size = 20.dp)
        Text(
            text  = "Ask Cinemood",
            style = MaterialTheme.typography.titleMedium.copy(
                color      = colors.ink,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(modifier = Modifier.weight(1f))
        ModeToggle(mode = mode, onMode = onMode)
        IconButton(onClick = onClose, modifier = Modifier.size(36.dp)) {
            Icon(Icons.Rounded.Close, "Close", tint = colors.dim, modifier = Modifier.size(20.dp))
        }
    }
}

// ── Mode toggle (Discover / Library) ─────────────────────────────────────────

@Composable
private fun ModeToggle(
    mode:   AssistantMode,
    onMode: (AssistantMode) -> Unit,
) {
    val colors = CinemoodTheme.colors
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(colors.paper2),
    ) {
        AssistantMode.entries.forEach { m ->
            val selected = mode == m
            Text(
                text     = if (m == AssistantMode.Discover) "Discover" else "My Library",
                style    = MaterialTheme.typography.labelSmall.copy(
                    color      = if (selected) Color.White else colors.dim,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                    fontSize   = 11.sp,
                ),
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(if (selected) colors.accent else Color.Transparent)
                    .clickable { onMode(m) }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            )
        }
    }
}

// ── Search field ──────────────────────────────────────────────────────────────

@Composable
private fun AssistantSearchField(
    query:    String,
    onChange: (String) -> Unit,
    onSearch: () -> Unit,
    onMic:    () -> Unit,
    searching: Boolean,
) {
    val colors = CinemoodTheme.colors
    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value         = query,
            onValueChange = onChange,
            modifier      = Modifier.weight(1f),
            placeholder   = {
                Text(
                    "Ask anything — genre, mood, director…",
                    style = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                )
            },
            singleLine    = true,
            shape         = RoundedCornerShape(14.dp),
            colors        = OutlinedTextFieldDefaults.colors(
                focusedBorderColor   = colors.accent,
                unfocusedBorderColor = colors.rule,
                focusedTextColor     = colors.ink,
                unfocusedTextColor   = colors.ink,
            ),
            leadingIcon   = { AiSearchIcon(size = 20.dp) },
            trailingIcon  = {
                when {
                    searching         -> CircularProgressIndicator(
                        color       = colors.accent,
                        modifier    = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                    query.isNotBlank() -> IconButton(onClick = onSearch) {
                        Icon(Icons.Rounded.Send, "Search", tint = colors.accent, modifier = Modifier.size(18.dp))
                    }
                }
            },
        )

        // Mic button
        FilledIconButton(
            onClick  = onMic,
            shape    = RoundedCornerShape(14.dp),
            colors   = IconButtonDefaults.filledIconButtonColors(
                containerColor = colors.accent,
                contentColor   = Color.White,
            ),
            modifier = Modifier.size(56.dp),
        ) {
            Icon(Icons.Rounded.Mic, "Search by voice", modifier = Modifier.size(22.dp))
        }
    }
}

// ── Parsed chips row ──────────────────────────────────────────────────────────

@Composable
private fun ParsedChipsRow(parsed: ParsedQuery) {
    val colors = CinemoodTheme.colors
    val f = parsed.filters

    val chips: List<String> = buildList {
        f.type?.forEach { t -> add(if (t == "movie") "Film" else "Series") }
        f.genres?.forEach { add(it) }
        f.excludeGenres?.forEach { add("not $it") }
        f.minRating?.let { add("≥ ${"%.1f".format(it)}★") }
        f.releaseAfter?.let { add("after ${it.take(4)}") }
        f.releaseBefore?.let { add("before ${it.take(4)}") }
        f.cast?.forEach { add(it) }
        f.providers?.forEach { add(it) }
    }
    val hasMood = parsed.semanticQuery.isNotBlank()

    if (chips.isEmpty() && !hasMood) return

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.paper2)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text  = "Parsed",
            style = MaterialTheme.typography.labelSmall.copy(
                color    = colors.faint,
                fontSize = 10.sp,
            ),
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            items(chips) { label ->
                ParsedChip(label = label, accent = false)
            }
            if (hasMood) {
                item {
                    ParsedChip(label = "mood: ${parsed.semanticQuery}", accent = true)
                }
            }
        }
    }
}

@Composable
private fun ParsedChip(label: String, accent: Boolean) {
    val colors = CinemoodTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                if (accent) colors.accent.copy(alpha = 0.12f) else colors.paper,
            )
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            text  = label.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(
                color     = if (accent) colors.accent else colors.dim,
                fontSize  = 10.sp,
                letterSpacing = 0.8.sp,
            ),
        )
    }
}

// ── Idle ──────────────────────────────────────────────────────────────────────

private val DISCOVER_PROMPTS = listOf(
    "dark sci-fi after 2015",
    "feel-good comedies",
    "Park Chan-wook films",
    "thriller under 2 hours",
    "rated above 8",
)

private val LIBRARY_PROMPTS = listOf(
    "something I started watching",
    "high-rated films I haven't seen",
    "sci-fi in my list",
    "under 90 minutes",
)

@Composable
private fun IdleContent(mode: AssistantMode, onPrompt: (String) -> Unit) {
    val colors  = CinemoodTheme.colors
    val prompts = if (mode == AssistantMode.Discover) DISCOVER_PROMPTS else LIBRARY_PROMPTS

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 24.dp, start = 16.dp, end = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text  = if (mode == AssistantMode.Discover)
                "Find new titles to add to your library"
            else
                "Search what you've saved",
            style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
        )

        Text(
            text  = "Try asking…",
            style = MaterialTheme.typography.labelSmall.copy(color = colors.dim),
        )

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(prompts) { prompt ->
                val colors2 = CinemoodTheme.colors
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(colors2.paper2)
                        .clickable { onPrompt(prompt) }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        Icons.Rounded.AutoAwesome,
                        null,
                        tint     = colors2.accent,
                        modifier = Modifier.size(12.dp),
                    )
                    Text(
                        text  = prompt,
                        style = MaterialTheme.typography.labelSmall.copy(color = colors2.ink),
                    )
                }
            }
        }
    }
}

// ── Listening ─────────────────────────────────────────────────────────────────

@Composable
private fun ListeningContent(interim: String, reduced: Boolean) {
    val colors     = CinemoodTheme.colors
    val transition = rememberInfiniteTransition(label = "mic")
    val scale      by transition.animateFloat(
        initialValue  = 0.85f,
        targetValue   = 1.15f,
        animationSpec = if (reduced) infiniteRepeatable(tween(0))
                        else infiniteRepeatable(tween(600, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label         = "micPulse",
    )

    Box(
        modifier         = Modifier.fillMaxWidth().padding(48.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(
                modifier         = Modifier
                    .size(64.dp * scale)
                    .clip(CircleShape)
                    .background(colors.accent.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Rounded.Mic,
                    null,
                    tint     = colors.accent,
                    modifier = Modifier.size(28.dp),
                )
            }
            Text(
                text  = if (interim.isBlank()) "Listening…" else interim,
                style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
            )
        }
    }
}

// ── Thinking (shimmer) ───────────────────────────────────────────────────────

@Composable
private fun ThinkingContent(reduced: Boolean) {
    val colors     = CinemoodTheme.colors
    val transition = rememberInfiniteTransition(label = "shimmer")
    val alpha      by transition.animateFloat(
        initialValue  = 0.25f,
        targetValue   = 0.55f,
        animationSpec = if (reduced) infiniteRepeatable(tween(0))
                        else infiniteRepeatable(tween(800, easing = LinearEasing), RepeatMode.Reverse),
        label         = "shimmerAlpha",
    )

    Column(
        modifier            = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text  = "Thinking…",
            style = MaterialTheme.typography.bodySmall.copy(
                color  = colors.faint,
                fontWeight = FontWeight.Medium,
            ),
            modifier = Modifier.padding(bottom = 4.dp),
        )
        repeat(4) {
            ShimmerCard(alpha = alpha, colors = colors)
        }
    }
}

@Composable
private fun ShimmerCard(alpha: Float, colors: cloud.cinemood.app.ui.theme.CinemoodColors) {
    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.paper2)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(width = 40.dp, height = 60.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(colors.rule.copy(alpha = alpha))
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(14.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colors.rule.copy(alpha = alpha))
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.4f)
                    .height(10.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colors.rule.copy(alpha = alpha * 0.7f))
            )
        }
    }
}

// ── Discover results ──────────────────────────────────────────────────────────

@Composable
private fun DiscoverResultsList(
    results:  List<TmdbResult>,
    addedIds: Set<Int>,
    reduced:  Boolean,
    onAdd:    (TmdbResult) -> Unit,
    onRemove: (TmdbResult) -> Unit,
    onOpen:   (TmdbResult) -> Unit,
) {
    val colors = CinemoodTheme.colors
    var visibleCount by remember(results) { mutableIntStateOf(if (reduced) results.size else 0) }

    LaunchedEffect(results, reduced) {
        if (!reduced) {
            for (i in results.indices) {
                delay(60L * i)
                visibleCount = i + 1
            }
        }
    }

    Text(
        text     = "Here are some films you might like",
        style    = MaterialTheme.typography.bodySmall.copy(
            color      = colors.faint,
            fontWeight = FontWeight.Medium,
        ),
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
    )

    LazyColumn(
        modifier       = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        itemsIndexed(results, key = { _, item -> item.id }) { index, item ->
            AnimatedVisibility(
                visible = index < visibleCount,
                enter   = if (reduced) fadeIn(tween(0))
                          else fadeIn(tween(200)) + slideInVertically(tween(200)) { it / 3 },
            ) {
                DiscoverResultCard(
                    item     = item,
                    added    = addedIds.contains(item.id),
                    onAdd    = { onAdd(item) },
                    onRemove = { onRemove(item) },
                    onOpen   = { onOpen(item) },
                )
            }
        }
    }
}

@Composable
private fun DiscoverResultCard(
    item:     TmdbResult,
    added:    Boolean,
    onAdd:    () -> Unit,
    onRemove: () -> Unit,
    onOpen:   () -> Unit,
) {
    val colors = CinemoodTheme.colors

    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.paper2),
        horizontalArrangement = Arrangement.spacedBy(0.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        // Tappable content area (poster + info) → opens preview sheet
        Row(
            modifier              = Modifier
                .weight(1f)
                .clickable(onClick = onOpen)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment     = Alignment.CenterVertically,
        ) {
            // Poster
            if (item.posterPath != null) {
                AsyncImage(
                    model              = "$TMDB_POSTER${item.posterPath}",
                    contentDescription = null,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier
                        .size(width = 44.dp, height = 64.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(colors.rule),
                )
            } else {
                Box(
                    modifier         = Modifier
                        .size(width = 44.dp, height = 64.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(colors.rule),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        item.title.take(2).uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                    )
                }
            }

            // Info
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text     = item.title,
                    style    = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val meta = listOfNotNull(
                    item.releaseDate?.take(4),
                    if (item.type == "series") "Series" else "Film",
                    item.voteAverage?.let { "★ ${"%.1f".format(it)}" },
                ).joinToString(" · ")
                Text(
                    text  = meta,
                    style = MaterialTheme.typography.labelSmall.copy(
                        color    = colors.faint,
                        fontSize = 10.sp,
                    ),
                )
                if (!item.overview.isNullOrBlank()) {
                    Text(
                        text     = item.overview,
                        style    = MaterialTheme.typography.bodySmall.copy(
                            color    = colors.dim,
                            fontSize = 11.sp,
                        ),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        // Add / Remove action — 44 dp touch target, separate from the card tap area
        Box(
            modifier         = Modifier
                .size(64.dp)
                .padding(end = 8.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (added) {
                FilledTonalIconButton(
                    onClick  = onRemove,
                    modifier = Modifier.size(44.dp),
                    shape    = RoundedCornerShape(10.dp),
                    colors   = IconButtonDefaults.filledTonalIconButtonColors(
                        containerColor = Color(0xFF34A853).copy(alpha = 0.12f),
                        contentColor   = Color(0xFF34A853),
                    ),
                ) {
                    Icon(Icons.Rounded.CheckCircle, "Remove from library", modifier = Modifier.size(22.dp))
                }
            } else {
                FilledTonalIconButton(
                    onClick  = onAdd,
                    modifier = Modifier.size(44.dp),
                    shape    = RoundedCornerShape(10.dp),
                    colors   = IconButtonDefaults.filledTonalIconButtonColors(
                        containerColor = colors.accent.copy(alpha = 0.12f),
                        contentColor   = colors.accent,
                    ),
                ) {
                    Icon(Icons.Rounded.Add, "Add to library", modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

// ── Library results ───────────────────────────────────────────────────────────

@Composable
private fun LibraryResultsList(
    results: List<WatchlistItem>,
    reduced: Boolean,
    onOpen:  (WatchlistItem) -> Unit,
) {
    val colors = CinemoodTheme.colors
    var visibleCount by remember(results) { mutableIntStateOf(if (reduced) results.size else 0) }

    LaunchedEffect(results, reduced) {
        if (!reduced) {
            for (i in results.indices) {
                delay(60L * i)
                visibleCount = i + 1
            }
        }
    }

    Text(
        text     = "From your library",
        style    = MaterialTheme.typography.bodySmall.copy(
            color      = colors.faint,
            fontWeight = FontWeight.Medium,
        ),
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
    )

    LazyColumn(
        modifier            = Modifier.fillMaxSize(),
        contentPadding      = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        itemsIndexed(results, key = { _, item -> item.title.id }) { index, item ->
            AnimatedVisibility(
                visible = index < visibleCount,
                enter   = if (reduced) fadeIn(tween(0))
                          else fadeIn(tween(200)) + slideInVertically(tween(200)) { it / 3 },
            ) {
                LibraryResultCard(item = item, onOpen = { onOpen(item) })
            }
        }
    }
}

@Composable
private fun LibraryResultCard(
    item:   WatchlistItem,
    onOpen: () -> Unit,
) {
    val colors = CinemoodTheme.colors
    val t      = item.title

    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.paper2)
            .clickable(onClick = onOpen)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        // Poster
        if (t.posterPath != null) {
            AsyncImage(
                model              = "$TMDB_POSTER${t.posterPath}",
                contentDescription = null,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier
                    .size(width = 44.dp, height = 64.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.rule),
            )
        } else {
            Box(
                modifier         = Modifier
                    .size(width = 44.dp, height = 64.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.rule),
                contentAlignment = Alignment.Center,
            ) {
                Text(t.title.take(2).uppercase(), style = MaterialTheme.typography.labelSmall.copy(color = colors.faint))
            }
        }

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text     = t.title,
                style    = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val meta = listOfNotNull(
                t.releaseDate?.take(4),
                if (t.type == "series") "Series" else "Film",
                (t.imdbRating ?: t.voteAverage)?.let { "★ ${"%.1f".format(it)}" },
            ).joinToString(" · ")
            Text(
                text  = meta,
                style = MaterialTheme.typography.labelSmall.copy(
                    color    = colors.faint,
                    fontSize = 10.sp,
                ),
            )
            // Status badge inline
            val statusLabel = when (item.status) {
                "watching" -> "Watching"
                "watched"  -> "Watched"
                else       -> "To watch"
            }
            Text(
                text  = statusLabel,
                style = MaterialTheme.typography.labelSmall.copy(
                    color    = colors.accent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                ),
            )
        }

        Icon(
            Icons.Rounded.ChevronRight,
            "Open",
            tint     = colors.faint,
            modifier = Modifier.size(20.dp),
        )
    }
}

// ── No results ────────────────────────────────────────────────────────────────

@Composable
private fun NoResultsContent(
    query:    String,
    mode:     AssistantMode,
    onSwitch: () -> Unit,
) {
    val colors = CinemoodTheme.colors
    Column(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(
            Icons.Rounded.SearchOff,
            null,
            tint     = colors.faint,
            modifier = Modifier.size(40.dp),
        )
        Text(
            text  = if (mode == AssistantMode.Discover)
                "Couldn't find new titles for \"$query\".\nTry a genre, mood, or director."
            else
                "Nothing in your library matches \"$query\".",
            style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
        )
        val switchLabel = if (mode == AssistantMode.Discover)
            "Search my library instead"
        else
            "Search all of TMDB instead"
        TextButton(onClick = onSwitch) {
            Icon(Icons.Rounded.SwapHoriz, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text(switchLabel, style = MaterialTheme.typography.labelMedium.copy(color = colors.accent))
        }
    }
}

// ── Error ─────────────────────────────────────────────────────────────────────

@Composable
private fun ErrorContent(message: String) {
    val colors = CinemoodTheme.colors
    Box(
        modifier         = Modifier.fillMaxWidth().padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text  = message,
            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.error),
        )
    }
}

// ── TMDB preview sheet ────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun TmdbPreviewSheet(
    item:      TmdbResult,
    title:     Title?,
    loading:   Boolean,
    added:     Boolean,
    onAdd:     () -> Unit,
    onRemove:  () -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = CinemoodTheme.colors

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor   = colors.paper,
        contentColor     = colors.ink,
        shape            = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle       = { BottomSheetDefaults.DragHandle(color = colors.rule) },
    ) {
        if (loading || title == null) {
            Box(
                modifier         = Modifier.fillMaxWidth().height(240.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = colors.accent, modifier = Modifier.size(32.dp), strokeWidth = 2.5.dp)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding()
                    .padding(bottom = 32.dp),
            ) {
                // Poster + title/meta/genres header
                Row(
                    modifier              = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment     = Alignment.Top,
                ) {
                    if (title.posterPath != null) {
                        AsyncImage(
                            model              = "https://image.tmdb.org/t/p/w342${title.posterPath}",
                            contentDescription = null,
                            contentScale       = ContentScale.Crop,
                            modifier           = Modifier
                                .width(96.dp)
                                .aspectRatio(2f / 3f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(colors.paper2),
                        )
                    } else {
                        Box(
                            modifier         = Modifier
                                .width(96.dp)
                                .aspectRatio(2f / 3f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(colors.paper2),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                title.title.take(2).uppercase(),
                                style = MaterialTheme.typography.headlineSmall.copy(color = colors.faint),
                            )
                        }
                    }

                    Column(
                        modifier            = Modifier.weight(1f).padding(top = 2.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text  = title.title,
                            style = MaterialTheme.typography.titleLarge.copy(
                                color      = colors.ink,
                                fontWeight = FontWeight.Bold,
                                lineHeight = 28.sp,
                            ),
                        )
                        val meta = listOfNotNull(
                            title.releaseDate?.take(4),
                            if (title.type == "series") "Series" else "Film",
                            title.runtime?.let { "${it}m" },
                            (title.imdbRating ?: title.voteAverage)?.let { "★ ${"%.1f".format(it)}" },
                        ).joinToString(" · ")
                        Text(
                            text  = meta,
                            style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                        )
                        if (title.genres.isNotEmpty()) {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement   = Arrangement.spacedBy(4.dp),
                            ) {
                                title.genres.take(4).forEach { genre ->
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(20.dp))
                                            .background(colors.accent.copy(alpha = 0.12f))
                                            .padding(horizontal = 8.dp, vertical = 3.dp),
                                    ) {
                                        Text(
                                            text  = genre,
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color    = colors.accent,
                                                fontSize = 11.sp,
                                            ),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(
                    color     = colors.rule,
                    thickness = 0.5.dp,
                    modifier  = Modifier.padding(horizontal = 16.dp),
                )

                // Overview
                if (!title.overview.isNullOrBlank()) {
                    Column(
                        modifier            = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .padding(top = 14.dp, bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text  = "OVERVIEW",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color         = colors.dim,
                                fontWeight    = FontWeight.SemiBold,
                                letterSpacing = 1.sp,
                                fontSize      = 10.sp,
                            ),
                        )
                        Text(
                            text  = title.overview,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color      = colors.ink,
                                lineHeight = 22.sp,
                            ),
                        )
                    }
                }

                // Cast
                if (title.cast.isNotEmpty()) {
                    Column(
                        modifier            = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            text  = "CAST",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color         = colors.dim,
                                fontWeight    = FontWeight.SemiBold,
                                letterSpacing = 1.sp,
                                fontSize      = 10.sp,
                            ),
                            modifier = Modifier.padding(horizontal = 16.dp),
                        )
                        LazyRow(
                            contentPadding        = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            items(title.cast.take(8)) { member ->
                                CastAvatarCard(member = member, colors = colors)
                            }
                        }
                    }
                }

                // Action button
                val btnText = if (added) "In Watchlist" else "Add to Watchlist"
                Button(
                    onClick  = { if (added) onRemove() else onAdd() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .height(52.dp),
                    shape    = RoundedCornerShape(14.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = if (added) Color(0xFF34A853).copy(alpha = 0.15f) else colors.accent,
                        contentColor   = if (added) Color(0xFF34A853) else Color.White,
                    ),
                ) {
                    Icon(
                        imageVector        = if (added) Icons.Rounded.CheckCircle else Icons.Rounded.Add,
                        contentDescription = null,
                        modifier           = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text  = btnText,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    )
                }
            }
        }
    }
}

@Composable
private fun CastAvatarCard(
    member: CastMember,
    colors: cloud.cinemood.app.ui.theme.CinemoodColors,
) {
    Column(
        modifier            = Modifier.width(68.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            modifier         = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(colors.paper2),
            contentAlignment = Alignment.Center,
        ) {
            if (member.profilePath != null) {
                AsyncImage(
                    model              = "https://image.tmdb.org/t/p/w185${member.profilePath}",
                    contentDescription = member.name,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Text(
                    text  = member.name.take(2).uppercase(),
                    style = MaterialTheme.typography.labelMedium.copy(color = colors.faint),
                )
            }
        }
        Text(
            text      = member.name,
            style     = MaterialTheme.typography.labelSmall.copy(color = colors.ink, fontSize = 11.sp),
            maxLines  = 2,
            overflow  = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier  = Modifier.fillMaxWidth(),
        )
        if (!member.character.isNullOrBlank()) {
            Text(
                text      = member.character,
                style     = MaterialTheme.typography.labelSmall.copy(color = colors.faint, fontSize = 9.sp),
                maxLines  = 1,
                overflow  = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier  = Modifier.fillMaxWidth(),
            )
        }
    }
}

// ── Voice helper ──────────────────────────────────────────────────────────────

private fun launchSpeech(
    context:  android.content.Context,
    launcher: androidx.activity.result.ActivityResultLauncher<Intent>,
    vm:       AssistantViewModel,
) {
    vm.state = AssistantState.Listening()
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PROMPT, "What are you in the mood for?")
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    launcher.launch(intent)
}
