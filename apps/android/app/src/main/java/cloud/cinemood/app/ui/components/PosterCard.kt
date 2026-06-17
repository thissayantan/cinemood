package cloud.cinemood.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.theme.*

private const val TMDB_IMG = "https://image.tmdb.org/t/p/w500"

@Composable
fun PosterCard(
    item: WatchlistItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    caption: String? = null,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(modifier = modifier.clickable(onClick = onClick)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(shape)
                .background(CineMoodPaper2),
        ) {
            if (item.posterPath != null) {
                AsyncImage(
                    model           = "$TMDB_IMG${item.posterPath}",
                    contentDescription = item.title,
                    contentScale    = ContentScale.Crop,
                    modifier        = Modifier.fillMaxSize(),
                )
            } else {
                // Text fallback when no poster is available
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text  = item.title.take(2).uppercase(),
                        style = MaterialTheme.typography.headlineLarge,
                        color = CineMoodFaint,
                    )
                }
            }

            // Status badge
            if (item.status == "watching") {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .background(CineMoodAccent, RoundedCornerShape(4.dp))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                ) {
                    Text(
                        text  = "WATCHING",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                    )
                }
            } else if (item.status == "watched") {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .background(CineMoodDim.copy(alpha = 0.85f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                ) {
                    Text(
                        text  = "WATCHED",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                    )
                }
            }

            // Rating chip
            val rating = item.imdbRating ?: item.voteAverage
            if (rating != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(6.dp)
                        .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                ) {
                    Text(
                        text  = "★ ${"%.1f".format(rating)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text     = item.title,
            style    = MaterialTheme.typography.bodySmall.copy(color = CineMoodInk),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )

        // Provider pill
        if (item.providers.isNotEmpty()) {
            Text(
                text     = item.providers.first(),
                style    = MaterialTheme.typography.labelSmall.copy(color = CineMoodFaint),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        // AI reason caption (For You shelf)
        if (caption != null) {
            Text(
                text     = caption,
                style    = MaterialTheme.typography.bodySmall.copy(color = CineMoodDim),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
