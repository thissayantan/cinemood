package cloud.cinemood.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.data.model.Recommendation
import cloud.cinemood.app.ui.theme.CineMoodDim
import cloud.cinemood.app.ui.theme.CineMoodFaint

/**
 * A horizontal shelf of poster cards with a labelled header.
 * Used on the Home / For-You screen.
 */
@Composable
fun ShelfRow(
    title: String,
    items: List<WatchlistItem>,
    onItemClick: (WatchlistItem) -> Unit,
    modifier: Modifier = Modifier,
    captions: Map<Int, String> = emptyMap(),  // titleId → AI reason
) {
    if (items.isEmpty()) return

    Column(modifier = modifier) {
        Text(
            text     = title.uppercase(),
            style    = MaterialTheme.typography.labelSmall.copy(color = CineMoodFaint),
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Spacer(modifier = Modifier.height(8.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(items, key = { it.id }) { item ->
                PosterCard(
                    item      = item,
                    onClick   = { onItemClick(item) },
                    caption   = captions[item.id],
                    modifier  = Modifier.width(130.dp),
                )
            }
        }
    }
}
