package cloud.cinemood.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.theme.CinemoodTheme

@Composable
fun ShelfRow(
    title: String,
    items: List<WatchlistItem>,
    onItemClick: (WatchlistItem) -> Unit,
    modifier: Modifier = Modifier,
    captions: Map<Int, String> = emptyMap(),
) {
    if (items.isEmpty()) return

    val colors = CinemoodTheme.colors

    Column(modifier = modifier) {
        Row(
            modifier              = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text  = title,
                style = MaterialTheme.typography.titleLarge.copy(color = colors.ink),
            )
            Text(
                text  = "See all",
                style = MaterialTheme.typography.labelSmall.copy(
                    color         = colors.faint,
                    letterSpacing = 0.sp,
                ),
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        LazyRow(
            contentPadding        = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(items, key = { it.title.id }) { item ->
                PosterCard(
                    item     = item,
                    onClick  = { onItemClick(item) },
                    caption  = captions[item.title.id],
                    modifier = Modifier.width(148.dp),
                )
            }
        }
    }
}
