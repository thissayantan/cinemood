package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.data.model.providerNames
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_IMG_BACKDROP = "https://image.tmdb.org/t/p/w780"
private const val TMDB_IMG_POSTER   = "https://image.tmdb.org/t/p/w342"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(
    item: WatchlistItem,
    onBack: () -> Unit,
    onSetStatus: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors
    val t      = item.title

    var overviewExpanded by remember { mutableStateOf(false) }
    var currentStatus by remember(item.status) { mutableStateOf(item.status) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.paper)
            .verticalScroll(rememberScrollState()),
    ) {
        // Full-bleed backdrop
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp),
        ) {
            val backdropUrl = t.backdropPath?.let { "$TMDB_IMG_BACKDROP$it" }
            val posterUrl   = t.posterPath?.let { "$TMDB_IMG_POSTER$it" }
            val imageUrl    = backdropUrl ?: posterUrl

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

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Black.copy(alpha = 0.4f),
                            0.6f to Color.Transparent,
                        ),
                    ),
            )

            IconButton(
                onClick  = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(8.dp),
            ) {
                Icon(
                    imageVector        = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint               = Color.White,
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Text(
                text  = t.title,
                style = MaterialTheme.typography.headlineMedium.copy(color = colors.ink),
            )
            Spacer(modifier = Modifier.height(4.dp))
            val year = t.releaseDate?.take(4)?.toIntOrNull()
            val meta = listOfNotNull(
                year?.toString(),
                t.runtime?.let { "${it}m" },
                if (t.type == "series") "Series" else "Film",
            ).joinToString(" · ")
            if (meta.isNotEmpty()) {
                Text(
                    text  = meta,
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                )
            }

            val rating = t.imdbRating ?: t.voteAverage
            if (rating != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text  = "★ ${"%.1f".format(rating)}",
                    style = MaterialTheme.typography.bodyMedium.copy(color = colors.accent),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            val providers = t.providerNames
            if (providers.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    providers.take(3).forEach { provider ->
                        SuggestionChip(
                            onClick = {},
                            label   = { Text(provider, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            Text(
                text  = "Status".uppercase(),
                style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("pending" to "Want to watch", "watching" to "Watching", "watched" to "Watched").forEach { (value, label) ->
                    val selected = currentStatus == value
                    FilterChip(
                        selected = selected,
                        onClick  = {
                            currentStatus = value
                            onSetStatus(value)
                        },
                        label  = { Text(label, style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = colors.accent,
                            selectedLabelColor     = Color.White,
                        ),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (!t.overview.isNullOrBlank()) {
                Text(
                    text     = "Overview".uppercase(),
                    style    = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text     = t.overview,
                    style    = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                    maxLines = if (overviewExpanded) Int.MAX_VALUE else 4,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!overviewExpanded) {
                    TextButton(
                        onClick = { overviewExpanded = true },
                        contentPadding = PaddingValues(0.dp),
                    ) {
                        Text("Show more", style = MaterialTheme.typography.labelSmall.copy(color = colors.dim))
                    }
                }
            }

            if (t.genres.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text  = "Genres".uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    t.genres.take(4).forEach { genre ->
                        SuggestionChip(
                            onClick = {},
                            label   = { Text(genre, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
            }
        }
    }
}
