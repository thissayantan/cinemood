package cloud.cinemood.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cloud.cinemood.app.ui.screens.LibraryFilters
import cloud.cinemood.app.ui.theme.CinemoodTheme

/**
 * A horizontally scrollable bar of removable filter chips + match count + Reset all.
 * Mirrors the web's active-chips component.
 *
 * Each chip tapped removes that specific filter dimension.
 * "Reset all" clears all filters (except the default sort).
 *
 * Only rendered when [filters] has at least one active dimension.
 */
@Composable
fun ActiveChips(
    filters:     LibraryFilters,
    matchCount:  Int,
    onPatch:     (LibraryFilters) -> Unit,
    modifier:    Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors

    // Build the chip list from active dimensions
    val chips = buildList<Pair<String, LibraryFilters>> {
        filters.type?.let { type ->
            val label = if (type == "movie") "Movies" else "Series"
            add(label to filters.copy(type = null))
        }
        filters.status?.let { s ->
            val label = when (s) {
                "watching" -> "Watching"
                "watched"  -> "Watched"
                else       -> "To watch"
            }
            add(label to filters.copy(status = null))
        }
        filters.genre?.let { g ->
            add(g to filters.copy(genre = null))
        }
        if (filters.yearMin != null || filters.yearMax != null) {
            val lo = filters.yearMin ?: 1920
            val hi = filters.yearMax
            val label = if (hi != null) "$lo – $hi" else "$lo+"
            add(label to filters.copy(yearMin = null, yearMax = null))
        }
        filters.minRating?.let { r ->
            add("≥ ${"%.1f".format(r)}★" to filters.copy(minRating = null))
        }
        if (filters.runtimeMin != null || filters.runtimeMax != null) {
            val lo = filters.runtimeMin ?: 0
            val hi = filters.runtimeMax ?: 240
            add("${lo}–${hi}m" to filters.copy(runtimeMin = null, runtimeMax = null))
        }
        filters.providers.forEach { p ->
            add(p to filters.copy(providers = filters.providers - p))
        }
    }

    if (chips.isEmpty()) return

    val isFiltered = chips.isNotEmpty()

    Row(
        modifier          = modifier
            .fillMaxWidth()
            .background(colors.paper2)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Match count badge
        if (isFiltered) {
            Text(
                text  = "$matchCount",
                style = MaterialTheme.typography.labelSmall.copy(
                    color         = colors.accent,
                    fontWeight    = FontWeight.Bold,
                    fontSize      = 11.sp,
                ),
            )
            Box(
                modifier = Modifier
                    .width(0.5.dp)
                    .height(14.dp)
                    .background(colors.rule),
            )
        }

        LazyRow(
            modifier              = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment     = Alignment.CenterVertically,
        ) {
            items(chips) { (label, next) ->
                ActiveFilterChip(label = label, onRemove = { onPatch(next) })
            }
        }

        // Reset all
        TextButton(
            onClick        = { onPatch(LibraryFilters(sort = filters.sort)) },
            contentPadding = PaddingValues(horizontal = 4.dp),
        ) {
            Text(
                "Reset all",
                style = MaterialTheme.typography.labelSmall.copy(
                    color    = colors.dim,
                    fontSize = 11.sp,
                ),
            )
        }
    }
}

@Composable
private fun ActiveFilterChip(label: String, onRemove: () -> Unit) {
    val colors = CinemoodTheme.colors
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(colors.paper)
            .clickable(onClick = onRemove)
            .padding(start = 10.dp, end = 6.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text  = label,
            style = MaterialTheme.typography.labelSmall.copy(
                color    = colors.ink,
                fontSize = 11.sp,
            ),
        )
        Icon(
            imageVector  = Icons.Rounded.Close,
            contentDescription = "Remove filter",
            tint         = colors.faint,
            modifier     = Modifier.size(14.dp),
        )
    }
}
