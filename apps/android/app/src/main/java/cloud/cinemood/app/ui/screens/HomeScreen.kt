package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.Recommendation
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.ShelfRow
import cloud.cinemood.app.ui.theme.CineMoodFaint
import kotlinx.coroutines.launch

// ── ViewModel ─────────────────────────────────────────────────────────────────

class HomeViewModel(private val api: CinemoodApi) : ViewModel() {

    var watchingItems   by mutableStateOf<List<WatchlistItem>>(emptyList())
    var topPicks        by mutableStateOf<List<Recommendation>>(emptyList())
    var quickWatches    by mutableStateOf<List<WatchlistItem>>(emptyList())
    var loading         by mutableStateOf(true)
    var error           by mutableStateOf<String?>(null)

    // In-memory cache — avoids LLM calls on every tab visit
    private var cachedAt = 0L

    init { load() }

    fun load(forceRefresh: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!forceRefresh && cachedAt > 0 && now - cachedAt < 5 * 60 * 1000L) return
        viewModelScope.launch {
            loading = true
            error   = null
            try {
                // Fetch all items first (quick, no LLM)
                val all = api.listWatchlist(limit = 200).getOrThrow()
                watchingItems = all.filter { it.status == "watching" }
                quickWatches  = all.filter { it.status == "pending" && (it.runtime ?: 999) < 100 }
                    .sortedByDescending { it.voteAverage }
                    .take(10)

                // AI recommendations (costs LLM — cached aggressively)
                val recs = api.recommend(mood = "great film tonight", status = "pending", limit = 10)
                    .getOrNull()
                topPicks = recs?.recommendations ?: emptyList()
                cachedAt = now
            } catch (e: Exception) {
                error = e.message
            }
            loading = false
        }
    }
}

// ── Screen ─────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: HomeViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    val topPickItems = vm.topPicks.mapNotNull { it.item }
    val topPickCaptions = vm.topPicks
        .filter { it.item != null }
        .associate { it.item!!.id to it.reason }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 120.dp, top = 16.dp), // 120dp = nav pill height
        verticalArrangement = Arrangement.spacedBy(28.dp),
    ) {
        if (vm.loading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(48.dp)) {
                    CircularProgressIndicator(modifier = Modifier.align(androidx.compose.ui.Alignment.Center))
                }
            }
            return@LazyColumn
        }

        vm.error?.let { err ->
            item {
                Text(
                    text     = "Could not load recommendations: $err",
                    style    = MaterialTheme.typography.bodySmall.copy(color = CineMoodFaint),
                    modifier = Modifier.padding(16.dp),
                )
            }
        }

        if (vm.watchingItems.isNotEmpty()) {
            item {
                ShelfRow(
                    title       = "Continue watching",
                    items       = vm.watchingItems,
                    onItemClick = onItemClick,
                )
            }
        }

        if (topPickItems.isNotEmpty()) {
            item {
                ShelfRow(
                    title       = "Top picks for tonight",
                    items       = topPickItems,
                    onItemClick = onItemClick,
                    captions    = topPickCaptions,
                )
            }
        }

        if (vm.quickWatches.isNotEmpty()) {
            item {
                ShelfRow(
                    title       = "Quick watches (under 100 min)",
                    items       = vm.quickWatches,
                    onItemClick = onItemClick,
                )
            }
        }
    }
}
