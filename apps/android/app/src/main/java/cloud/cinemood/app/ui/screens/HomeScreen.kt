package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.Recommendation
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.ShelfRow
import cloud.cinemood.app.ui.theme.CinemoodTheme
import kotlinx.coroutines.launch

private const val TMDB_BACKDROP = "https://image.tmdb.org/t/p/w780"
private const val TMDB_POSTER   = "https://image.tmdb.org/t/p/w500"

// ── ViewModel ─────────────────────────────────────────────────────────────────

class HomeViewModel(private val api: CinemoodApi) : ViewModel() {

    var watchingItems   by mutableStateOf<List<WatchlistItem>>(emptyList())
    var topPicks        by mutableStateOf<List<Recommendation>>(emptyList())
    var topPickItems    by mutableStateOf<List<WatchlistItem>>(emptyList())
    var quickWatches    by mutableStateOf<List<WatchlistItem>>(emptyList())
    var loading         by mutableStateOf(true)
    var error           by mutableStateOf<String?>(null)

    private var cachedAt = 0L

    init { load() }

    fun load(forceRefresh: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!forceRefresh && cachedAt > 0 && now - cachedAt < 5 * 60 * 1000L) return
        viewModelScope.launch {
            loading = true
            error   = null
            try {
                val all = api.listWatchlist(limit = 200).getOrThrow()
                watchingItems = all.filter { it.status == "watching" }
                quickWatches  = all.filter { it.status == "pending" && (it.title.runtime ?: 999) < 100 }
                    .sortedByDescending { it.title.voteAverage }
                    .take(10)

                val recs = api.recommend(mood = "great film tonight", status = "pending", limit = 10)
                    .getOrNull()
                topPicks     = recs?.recommendations ?: emptyList()
                topPickItems = recs?.items ?: emptyList()
                cachedAt = now
            } catch (e: Exception) {
                error = e.message
            }
            loading = false
        }
    }
}

// ── Screen ─────────────────────────────────────────────────────────────────────

@Composable
fun HomeScreen(
    vm: HomeViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors

    val topPickCaptions = run {
        val byId = vm.topPickItems.associateBy { it.title.id }
        vm.topPicks.mapNotNull { rec ->
            byId[rec.titleId]?.let { rec.titleId to rec.reason }
        }.toMap()
    }

    // Hero = first top pick, falling back to first "watching" item
    val heroItem   = vm.topPickItems.firstOrNull() ?: vm.watchingItems.firstOrNull()
    val heroReason = vm.topPicks.firstOrNull()?.reason

    LazyColumn(
        modifier        = modifier.fillMaxSize().statusBarsPadding(),
        contentPadding  = PaddingValues(top = 12.dp, bottom = 160.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        if (vm.loading) {
            item {
                Box(
                    modifier         = Modifier.fillMaxWidth().height(320.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = colors.accent)
                }
            }
            return@LazyColumn
        }

        // ── Hero card ─────────────────────────────────────────────────────────
        if (heroItem != null) {
            item {
                HeroCard(
                    item     = heroItem,
                    reason   = heroReason,
                    onClick  = { onItemClick(heroItem) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                )
            }
        }

        vm.error?.let { err ->
            item {
                Text(
                    text     = err,
                    style    = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }

        // ── Continue Watching shelf ───────────────────────────────────────────
        if (vm.watchingItems.isNotEmpty()) {
            item {
                ShelfRow(
                    title       = "Continue Watching",
                    items       = vm.watchingItems,
                    onItemClick = onItemClick,
                    modifier    = Modifier.padding(top = if (heroItem != null) 8.dp else 16.dp),
                )
            }
        }

        // ── Top Picks shelf ───────────────────────────────────────────────────
        if (vm.topPickItems.isNotEmpty()) {
            item {
                ShelfRow(
                    title       = "Tonight's Top Picks",
                    items       = vm.topPickItems.drop(if (heroItem != null && vm.watchingItems.isEmpty()) 1 else 0),
                    onItemClick = onItemClick,
                    captions    = topPickCaptions,
                    modifier    = Modifier.padding(top = 24.dp),
                )
            }
        }

        // ── Quick Watches shelf ───────────────────────────────────────────────
        if (vm.quickWatches.isNotEmpty()) {
            item {
                ShelfRow(
                    title       = "Quick Watches · Under 100 min",
                    items       = vm.quickWatches,
                    onItemClick = onItemClick,
                    modifier    = Modifier.padding(top = 24.dp),
                )
            }
        }

        // Empty state
        if (!vm.loading && heroItem == null && vm.watchingItems.isEmpty()
            && vm.topPickItems.isEmpty() && vm.quickWatches.isEmpty()) {
            item {
                Box(
                    modifier         = Modifier.fillMaxWidth().padding(48.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text  = "Add something to your library to get started.",
                        style = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                    )
                }
            }
        }
    }
}

// ── Hero card ─────────────────────────────────────────────────────────────────

@Composable
private fun HeroCard(
    item:     WatchlistItem,
    reason:   String?,
    onClick:  () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors
    val t      = item.title
    val imageUrl = t.backdropPath?.let { "$TMDB_BACKDROP$it" }
        ?: t.posterPath?.let { "$TMDB_POSTER$it" }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(240.dp)
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
    ) {
        // Backdrop image
        if (imageUrl != null) {
            AsyncImage(
                model              = imageUrl,
                contentDescription = t.title,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier.fillMaxSize(),
            )
        } else {
            Box(modifier = Modifier.fillMaxSize().background(colors.paper2))
        }

        // Gradient scrim — transparent top → dark bottom
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.0f to Color.Transparent,
                        0.45f to Color.Black.copy(alpha = 0.2f),
                        1.0f to Color.Black.copy(alpha = 0.88f),
                    )
                ),
        )

        // Content — bottom-aligned
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Eyebrow
            Text(
                text  = if (item.status == "watching") "CONTINUE WATCHING" else "TONIGHT'S PICK",
                style = MaterialTheme.typography.labelSmall.copy(
                    color         = colors.accent,
                    letterSpacing = 1.2.sp,
                ),
            )
            // Title
            Text(
                text     = t.title,
                style    = MaterialTheme.typography.headlineMedium.copy(color = Color.White),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            // Meta row
            val year = t.releaseDate?.take(4)
            val meta = listOfNotNull(
                year,
                t.runtime?.let { "${it}m" },
                if (t.type == "series") "Series" else "Film",
                (t.imdbRating ?: t.voteAverage)?.let { "★ ${"%.1f".format(it)}" },
            ).joinToString("  ·  ")
            if (meta.isNotEmpty()) {
                Text(
                    text  = meta,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = Color.White.copy(alpha = 0.72f),
                    ),
                )
            }
            // AI reason
            if (!reason.isNullOrBlank()) {
                Text(
                    text     = reason,
                    style    = MaterialTheme.typography.bodySmall.copy(
                        color = Color.White.copy(alpha = 0.55f),
                    ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
