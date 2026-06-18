package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.FilterList
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.ActiveChips
import cloud.cinemood.app.ui.components.FilterSheet
import cloud.cinemood.app.ui.components.PosterCard
import cloud.cinemood.app.ui.theme.CinemoodTheme
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// ── Sort labels (shared with FilterSheet) ─────────────────────────────────────

val SORT_LABELS = linkedMapOf(
    "added_desc"   to "Recently added",
    "added_asc"    to "Earliest added",
    "title_asc"    to "Title A–Z",
    "year_desc"    to "Year (newest)",
    "year_asc"     to "Year (oldest)",
    "rating_desc"  to "Rating (highest)",
    "catalog_desc" to "Spine number",
    "started_desc" to "Started watching",
)

// ── Filter state ──────────────────────────────────────────────────────────────

data class LibraryFilters(
    val type:       String?     = null,   // "movie" | "series"
    val status:     String?     = null,   // "pending" | "watching" | "watched"
    val genre:      String?     = null,
    val yearMin:    Int?        = null,
    val yearMax:    Int?        = null,
    val minRating:  Float?      = null,
    val runtimeMin: Int?        = null,
    val runtimeMax: Int?        = null,
    val providers:  Set<String> = emptySet(),
    val sort:       String      = "added_desc",
)

data class LibraryFacets(
    val genres:    List<String>       = emptyList(),
    val providers: List<String>       = emptyList(),
)

// ── ViewModel ─────────────────────────────────────────────────────────────────

class WatchlistViewModel(private val api: CinemoodApi) : ViewModel() {

    var loading by mutableStateOf(true)
    var error   by mutableStateOf<String?>(null)

    // All items + facets — updated together
    var allItems by mutableStateOf<List<WatchlistItem>>(emptyList())
    var facets   by mutableStateOf(LibraryFacets())
        private set

    // Active filter state
    var filters by mutableStateOf(LibraryFilters())

    // Derived: filtered + sorted list
    val displayed: List<WatchlistItem>
        get() = applyFilters(allItems, filters)

    // Counts for Settings quick-nav (status → count)
    val countByStatus: Map<String, Int>
        get() = allItems.groupBy { it.status }.mapValues { it.value.size }

    // Active filter badge count (excludes sort-only)
    val activeFilterCount: Int
        get() {
            var n = 0
            with(filters) {
                if (type != null) n++
                if (status != null) n++
                if (genre != null) n++
                if (yearMin != null || yearMax != null) n++
                if (minRating != null) n++
                if (runtimeMin != null || runtimeMax != null) n++
                n += providers.size
            }
            return n
        }

    // Convenience setter that also recomputes facets
    fun updateAllItems(items: List<WatchlistItem>) {
        allItems = items
        facets   = deriveFacets(items)
    }

    // Backward-compat: MainActivity sets this via property assignment.
    var statusFilter: String?
        get() = filters.status
        set(v) { filters = filters.copy(status = v) }

    init { load() }

    fun load() {
        viewModelScope.launch {
            loading = true
            error   = null
            api.listWatchlist(limit = 500).fold(
                onSuccess = { items ->
                    updateAllItems(items)
                    loading = false
                },
                onFailure = {
                    error   = it.message
                    loading = false
                },
            )
        }
    }

    fun setStatus(titleId: Int, status: String) {
        viewModelScope.launch {
            api.setStatus(titleId, status).onSuccess {
                val updated = allItems.map { if (it.title.id == titleId) it.copy(status = status) else it }
                updateAllItems(updated)
            }
        }
    }

    fun removeItem(titleId: Int) {
        viewModelScope.launch {
            api.removeFromWatchlist(titleId).onSuccess {
                val updated = allItems.filter { it.title.id != titleId }
                updateAllItems(updated)
            }
        }
    }
}

// ── Facets derivation ─────────────────────────────────────────────────────────

private fun deriveFacets(items: List<WatchlistItem>): LibraryFacets {
    val genres    = mutableSetOf<String>()
    val providers = mutableSetOf<String>()

    for (item in items) {
        genres.addAll(item.title.genres)
        providers.addAll(allProviderNames(item))
    }

    return LibraryFacets(
        genres    = genres.sorted(),
        providers = providers.sorted().take(12),
    )
}

/** Collect all provider names from a WatchlistItem regardless of region. */
private fun allProviderNames(item: WatchlistItem): List<String> {
    val json = item.title.providers ?: return emptyList()
    val names = mutableSetOf<String>()
    for (regionKey in json.keys) {
        val regionObj = json[regionKey] as? JsonObject ?: continue
        val flatrate  = regionObj["flatrate"] as? JsonArray ?: continue
        for (entry in flatrate) {
            (entry as? JsonObject)?.get("provider_name")?.jsonPrimitive?.contentOrNull?.let {
                names.add(it)
            }
        }
    }
    return names.toList()
}

// ── Filter + sort engine ──────────────────────────────────────────────────────

private fun applyFilters(items: List<WatchlistItem>, f: LibraryFilters): List<WatchlistItem> {
    var result = items

    if (f.type != null)    result = result.filter { it.title.type == f.type }
    if (f.status != null)  result = result.filter { it.status == f.status }
    if (f.genre != null)   result = result.filter { f.genre in it.title.genres }

    f.yearMin?.let { min -> result = result.filter {
        (it.title.releaseDate?.take(4)?.toIntOrNull() ?: 0) >= min
    } }
    f.yearMax?.let { max -> result = result.filter {
        (it.title.releaseDate?.take(4)?.toIntOrNull() ?: 9999) <= max
    } }

    f.minRating?.let { minR -> result = result.filter {
        (it.title.imdbRating?.toFloat() ?: it.title.voteAverage?.toFloat() ?: 0f) >= minR
    } }

    f.runtimeMin?.let { minRt -> result = result.filter {
        (it.title.runtime ?: 0) >= minRt
    } }
    f.runtimeMax?.let { maxRt -> result = result.filter {
        (it.title.runtime ?: 999) <= maxRt
    } }

    if (f.providers.isNotEmpty()) {
        result = result.filter { item ->
            allProviderNames(item).any { p -> p in f.providers }
        }
    }

    return sortItems(result, f.sort)
}

private fun sortItems(items: List<WatchlistItem>, sort: String): List<WatchlistItem> = when (sort) {
    "added_asc"    -> items.sortedBy { it.addedAt }
    "title_asc"    -> items.sortedBy { it.title.title.lowercase() }
    "year_desc"    -> items.sortedByDescending { it.title.releaseDate?.take(4)?.toIntOrNull() ?: 0 }
    "year_asc"     -> items.sortedBy { it.title.releaseDate?.take(4)?.toIntOrNull() ?: Int.MAX_VALUE }
    "rating_desc"  -> items.sortedByDescending { it.title.imdbRating ?: it.title.voteAverage ?: 0.0 }
    "catalog_desc" -> items.sortedByDescending { it.catalogNo }
    "started_desc" -> items.sortedByDescending { it.startedAt ?: 0L }
    else           -> items.sortedByDescending { it.addedAt } // added_desc
}

// ── Screen ─────────────────────────────────────────────────────────────────────

@Composable
fun WatchlistScreen(
    vm:          WatchlistViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    modifier:    Modifier = Modifier,
) {
    val colors      = CinemoodTheme.colors
    val displayed   = vm.displayed
    val count       = displayed.size
    val total       = vm.allItems.size
    var showFilters by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        // ── Header ────────────────────────────────────────────────────────────
        Row(
            modifier              = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalAlignment     = Alignment.Bottom,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text  = "Library",
                style = MaterialTheme.typography.headlineMedium.copy(color = colors.ink),
            )
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (!vm.loading) {
                    Text(
                        text  = if (vm.activeFilterCount > 0) "$count of $total" else "$total titles",
                        style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                        modifier = Modifier.padding(bottom = 2.dp),
                    )
                }
                // Filter button with active-count badge
                Box {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (vm.activeFilterCount > 0) colors.accent.copy(alpha = 0.12f)
                                else colors.paper2,
                            )
                            .clickable { showFilters = true },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Rounded.FilterList,
                            "Filters",
                            tint     = if (vm.activeFilterCount > 0) colors.accent else colors.dim,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    if (vm.activeFilterCount > 0) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 3.dp, y = (-3).dp)
                                .size(14.dp)
                                .clip(CircleShape)
                                .background(colors.accent),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text  = "${vm.activeFilterCount}",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color    = Color.White,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                            )
                        }
                    }
                }
            }
        }

        // ── Active filter chips bar ────────────────────────────────────────────
        ActiveChips(
            filters    = vm.filters,
            matchCount = count,
            onPatch    = { vm.filters = it },
        )

        HorizontalDivider(color = colors.rule, thickness = 0.5.dp)

        // ── Content ───────────────────────────────────────────────────────────
        when {
            vm.loading -> Box(
                modifier         = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = colors.accent)
            }

            vm.error != null -> Box(
                modifier         = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text     = vm.error ?: "Something went wrong",
                    style    = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                    modifier = Modifier.padding(32.dp),
                )
            }

            displayed.isEmpty() && vm.allItems.isEmpty() -> Box(
                modifier         = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text     = "Your library is empty.\nAdd films and series to get started.",
                    style    = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                    modifier = Modifier.padding(32.dp),
                )
            }

            displayed.isEmpty() -> Box(
                modifier         = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier            = Modifier.padding(32.dp),
                ) {
                    Text(
                        "No titles match these filters.",
                        style = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                    )
                    TextButton(onClick = { vm.filters = LibraryFilters(sort = vm.filters.sort) }) {
                        Text("Reset filters", style = MaterialTheme.typography.labelMedium.copy(color = colors.accent))
                    }
                }
            }

            else -> LazyVerticalGrid(
                columns               = GridCells.Fixed(2),
                contentPadding        = PaddingValues(
                    start  = 16.dp,
                    end    = 16.dp,
                    top    = 12.dp,
                    bottom = 120.dp,
                ),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement   = Arrangement.spacedBy(18.dp),
                modifier              = Modifier.fillMaxSize(),
            ) {
                items(displayed, key = { it.title.id }) { item ->
                    PosterCard(
                        item    = item,
                        onClick = { onItemClick(item) },
                    )
                }
            }
        }
    }

    // ── Filter sheet ──────────────────────────────────────────────────────────
    if (showFilters) {
        FilterSheet(
            filters   = vm.filters,
            facets    = vm.facets,
            onFilters = { vm.filters = it },
            onDismiss = { showFilters = false },
        )
    }
}

// ── CinemoodChip (kept for compatibility with other screens) ──────────────────

@Composable
fun CinemoodChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = CinemoodTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) colors.accent else colors.paper2)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text  = label,
            style = MaterialTheme.typography.labelSmall.copy(
                color = if (selected) Color.White else colors.dim,
            ),
        )
    }
}
