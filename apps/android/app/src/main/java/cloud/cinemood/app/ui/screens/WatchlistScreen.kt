package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.PosterCard
import cloud.cinemood.app.ui.theme.CinemoodTheme
import kotlinx.coroutines.launch

// ── ViewModel ─────────────────────────────────────────────────────────────────

class WatchlistViewModel(private val api: CinemoodApi) : ViewModel() {

    var allItems    by mutableStateOf<List<WatchlistItem>>(emptyList())
    var loading     by mutableStateOf(true)
    var error       by mutableStateOf<String?>(null)

    var typeFilter   by mutableStateOf<String?>(null)
    var statusFilter by mutableStateOf<String?>(null)

    val displayed: List<WatchlistItem>
        get() = allItems
            .filter { typeFilter == null || it.title.type == typeFilter }
            .filter { statusFilter == null || it.status == statusFilter }

    val countByStatus: Map<String, Int>
        get() = allItems.groupBy { it.status }.mapValues { it.value.size }

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
                allItems = allItems.map { if (it.title.id == titleId) it.copy(status = status) else it }
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
    val colors = CinemoodTheme.colors
    val count  = vm.displayed.size

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
            if (!vm.loading) {
                Text(
                    text  = "$count titles",
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
        }

        // ── Single combined filter row ─────────────────────────────────────────
        Row(
            modifier              = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment     = Alignment.CenterVertically,
        ) {
            // Type chips
            listOf(null to "All", "movie" to "Movies", "series" to "Shows").forEach { (value, label) ->
                CinemoodChip(
                    label    = label,
                    selected = vm.typeFilter == value,
                    onClick  = { vm.typeFilter = value },
                )
            }

            // Visual separator
            Box(
                modifier = Modifier
                    .height(20.dp)
                    .width(1.dp)
                    .background(colors.rule),
            )

            // Status chips
            listOf(
                null        to "All",
                "pending"   to "To watch",
                "watching"  to "Watching",
                "watched"   to "Watched",
            ).forEach { (value, label) ->
                CinemoodChip(
                    label    = label,
                    selected = vm.statusFilter == value,
                    onClick  = { vm.statusFilter = value },
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
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
                    text  = vm.error ?: "Something went wrong",
                    style = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                    modifier = Modifier.padding(32.dp),
                )
            }

            vm.displayed.isEmpty() -> Box(
                modifier         = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text  = if (vm.typeFilter != null || vm.statusFilter != null)
                        "No titles match this filter."
                    else
                        "Your library is empty.\nAdd films and series to get started.",
                    style = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                    modifier = Modifier.padding(32.dp),
                )
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
                items(vm.displayed, key = { it.title.id }) { item ->
                    PosterCard(
                        item    = item,
                        onClick = { onItemClick(item) },
                    )
                }
            }
        }
    }
}

// ── Custom chip (themed, no Material FilterChip defaults) ─────────────────────

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
            .background(
                if (selected) colors.accent else colors.paper2,
            )
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
