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
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_IMG = "https://image.tmdb.org/t/p/w500"

@Composable
fun PosterCard(
    item: WatchlistItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    caption: String? = null,
) {
    val colors = CinemoodTheme.colors
    val shape  = RoundedCornerShape(12.dp)
    val t      = item.title

    Column(modifier = modifier.clickable(onClick = onClick)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(shape)
                .background(colors.paper2),
        ) {
            if (t.posterPath != null) {
                AsyncImage(
                    model              = "$TMDB_IMG${t.posterPath}",
                    contentDescription = t.title,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text  = t.title.take(2).uppercase(),
                        style = MaterialTheme.typography.headlineLarge,
                        color = colors.faint,
                    )
                }
            }

            // Status badge
            if (item.status == "watching") {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .background(colors.accent, RoundedCornerShape(4.dp))
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
                        .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
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
            val rating = t.imdbRating ?: t.voteAverage
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
            text     = t.title,
            style    = MaterialTheme.typography.bodyMedium.copy(
                color      = colors.ink,
                fontSize   = androidx.compose.ui.unit.TextUnit(13f, androidx.compose.ui.unit.TextUnitType.Sp),
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )

        // Year + type — concise meta line
        val metaLine = listOfNotNull(
            t.releaseDate?.take(4),
            if (t.type == "series") "Series" else "Film",
        ).joinToString(" · ")
        Text(
            text     = metaLine,
            style    = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
            maxLines = 1,
        )

        // AI reason caption (For You shelf)
        if (caption != null) {
            Text(
                text     = caption,
                style    = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
