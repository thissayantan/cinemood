package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.PosterCard
import cloud.cinemood.app.ui.theme.CineMoodAccent
import cloud.cinemood.app.ui.theme.CineMoodFaint
import cloud.cinemood.app.ui.theme.CineMoodInk
import kotlinx.coroutines.launch

// ── ViewModel ─────────────────────────────────────────────────────────────────

class WatchlistViewModel(private val api: CinemoodApi) : ViewModel() {

    var allItems    by mutableStateOf<List<WatchlistItem>>(emptyList())
    var loading     by mutableStateOf(true)
    var error       by mutableStateOf<String?>(null)

    // Filters
    var typeFilter   by mutableStateOf<String?>(null) // null=All, "movie", "series"
    var statusFilter by mutableStateOf<String?>(null)

    val displayed: List<WatchlistItem>
        get() = allItems
            .filter { typeFilter == null || it.type == typeFilter }
            .filter { statusFilter == null || it.status == statusFilter }

    init { load() }

    fun load() {
        viewModelScope.launch {
            loading = true
            error   = null
            api.listWatchlist(limit = 500).fold(
                onSuccess = { allItems = it; loading = false },
                onFailure = { error = it.message; loading = false },
            )
        }
    }

    fun setStatus(titleId: Int, status: String) {
        viewModelScope.launch {
            api.setStatus(titleId, status).onSuccess {
                allItems = allItems.map { if (it.id == titleId) it.copy(status = status) else it }
            }
        }
    }
}

// ── Screen ─────────────────────────────────────────────────────────────────────

@Composable
fun WatchlistScreen(
    vm: WatchlistViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        // Type filter chips
        FilterRow(
            options  = listOf(null to "All", "movie" to "Movies", "series" to "Shows"),
            selected = vm.typeFilter,
            onSelect = { vm.typeFilter = it },
        )
        // Status filter chips
        FilterRow(
            options  = listOf(null to "All", "pending" to "Pending", "watching" to "Watching", "watched" to "Watched"),
            selected = vm.statusFilter,
            onSelect = { vm.statusFilter = it },
        )

        when {
            vm.loading -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) { CircularProgressIndicator() }

            vm.error != null -> Text(
                text     = "Error: ${vm.error}",
                modifier = Modifier.padding(16.dp),
                color    = CineMoodFaint,
            )

            vm.displayed.isEmpty() -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text  = "Nothing here yet.\nAdd a film or series to get started.",
                    style = MaterialTheme.typography.bodyMedium.copy(color = CineMoodFaint),
                )
            }

            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                items(vm.displayed, key = { it.id }) { item ->
                    PosterCard(
                        item    = item,
                        onClick = { onItemClick(item) },
                    )
                }
            }
        }
    }
}

// ── Filter chip row ───────────────────────────────────────────────────────────

@Composable
private fun FilterRow(
    options: List<Pair<String?, String>>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = selected == value,
                onClick  = { onSelect(value) },
                label    = { Text(label, style = MaterialTheme.typography.labelSmall) },
                colors   = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CineMoodAccent,
                    selectedLabelColor     = androidx.compose.ui.graphics.Color.White,
                ),
            )
        }
    }
}
