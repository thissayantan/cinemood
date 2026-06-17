package cloud.cinemood.app.ui.screens.decide

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.model.CompareCell
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.components.PosterCard
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_POSTER = "https://image.tmdb.org/t/p/w185"

@Composable
fun CompareSection(
    vm:          DecideViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    onBack:      () -> Unit,
    modifier:    Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors
    val result = vm.compareResult

    if (result != null) {
        // ── Results view ──────────────────────────────────────────────────────
        LazyColumn(
            modifier       = modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(bottom = 120.dp),
        ) {
            item {
                Row(
                    modifier          = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { vm.resetCompare() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = colors.ink)
                    }
                    Text(
                        "Compare",
                        style = MaterialTheme.typography.titleMedium.copy(color = colors.ink, fontWeight = FontWeight.Bold),
                    )
                }
            }
            items(result.rows) { cell ->
                CompareCellCard(cell = cell)
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    } else {
        // ── Selection view ────────────────────────────────────────────────────
        Column(
            modifier = modifier
                .fillMaxSize()
                .statusBarsPadding(),
        ) {
            // Header
            Row(
                modifier          = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = colors.ink)
                    }
                    Text(
                        "Compare titles",
                        style = MaterialTheme.typography.titleMedium.copy(color = colors.ink, fontWeight = FontWeight.Bold),
                    )
                }
                Text(
                    "${vm.selectedIds.size}/6",
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                )
            }

            Text(
                text     = "Select 2–6 titles to compare",
                style    = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
            )

            if (vm.compareLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(color = colors.accent)
                        Text("Analysing…", style = MaterialTheme.typography.bodySmall.copy(color = colors.dim))
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns               = GridCells.Fixed(2),
                    modifier              = Modifier.weight(1f),
                    contentPadding        = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement   = Arrangement.spacedBy(14.dp),
                ) {
                    items(vm.watchlist, key = { it.title.id }) { item ->
                        val selected = vm.selectedIds.contains(item.title.id)
                        Box {
                            PosterCard(
                                item     = item,
                                onClick  = { vm.toggleSelect(item.title.id) },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            if (selected) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(6.dp)
                                        .size(24.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(colors.accent),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }

                vm.compareError?.let { err ->
                    Text(
                        text     = err,
                        style    = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.error),
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                ) {
                    Button(
                        onClick  = { vm.runCompare() },
                        enabled  = vm.selectedIds.size in 2..6 && !vm.compareLoading,
                        modifier = Modifier.fillMaxWidth(),
                        shape    = RoundedCornerShape(12.dp),
                        colors   = ButtonDefaults.buttonColors(containerColor = colors.accent),
                    ) {
                        Text("Compare ${if (vm.selectedIds.size >= 2) "${vm.selectedIds.size} titles" else "titles"}")
                    }
                }
            }
        }
    }
}

@Composable
private fun CompareCellCard(cell: CompareCell) {
    val colors = CinemoodTheme.colors

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(colors.paper2),
    ) {
        // Card header: poster + name
        Row(
            modifier              = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment     = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(width = 44.dp, height = 66.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.paper),
                contentAlignment = Alignment.Center,
            ) {
                Text(cell.title.take(2).uppercase(), style = MaterialTheme.typography.labelSmall.copy(color = colors.faint))
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text     = cell.title,
                    style    = MaterialTheme.typography.titleMedium.copy(color = colors.ink),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val meta = listOfNotNull(
                    cell.year,
                    cell.runtime?.let { "${it}m" },
                    if (cell.type == "series") "Series" else "Film",
                ).joinToString(" · ")
                if (meta.isNotEmpty()) {
                    Text(text = meta, style = MaterialTheme.typography.bodySmall.copy(color = colors.faint))
                }
            }
        }

        HorizontalDivider(color = colors.rule, thickness = 0.5.dp)

        // Deterministic rows
        val rows = buildList {
            cell.voteAverage?.let { add("TMDB" to "★ ${"%.1f".format(it)}") }
            cell.imdbRating?.let  { add("IMDb" to "★ ${"%.1f".format(it)}") }
            if (cell.genres.isNotEmpty()) add("Genres" to cell.genres.take(3).joinToString(", "))
            if (cell.providers.isNotEmpty()) add("Stream on" to cell.providers.take(3).joinToString(", "))
        }
        rows.forEach { (label, value) ->
            CompareRow(label, value)
        }

        // AI analysis
        if (cell.mood.isNotEmpty() || cell.pacing.isNotEmpty() || cell.tone.isNotEmpty() || cell.criticalConsensus.isNotEmpty()) {
            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)
            Row(
                modifier          = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(Icons.Rounded.Star, null, tint = colors.accent, modifier = Modifier.size(14.dp))
                Text(
                    "AI analysis",
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint, letterSpacing = 1.sp),
                )
            }
            if (cell.mood.isNotEmpty())            CompareRow("Mood",      cell.mood)
            if (cell.pacing.isNotEmpty())          CompareRow("Pacing",    cell.pacing)
            if (cell.tone.isNotEmpty())            CompareRow("Tone",      cell.tone)
            if (cell.criticalConsensus.isNotEmpty()) CompareRow("Critics", cell.criticalConsensus)
            if (cell.watchIfYouLiked.isNotEmpty()) CompareRow("If you liked", cell.watchIfYouLiked.take(2).joinToString(", "))
        }
    }
}

@Composable
private fun CompareRow(label: String, value: String) {
    val colors = CinemoodTheme.colors
    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment     = Alignment.Top,
    ) {
        Text(
            text     = label.uppercase(),
            style    = MaterialTheme.typography.labelSmall.copy(color = colors.faint, fontSize = 9.sp),
            modifier = Modifier.width(72.dp),
        )
        Text(
            text     = value,
            style    = MaterialTheme.typography.bodySmall.copy(color = colors.ink),
            modifier = Modifier.weight(1f),
        )
    }
}
