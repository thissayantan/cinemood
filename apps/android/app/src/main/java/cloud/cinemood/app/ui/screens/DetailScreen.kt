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
            val backdropUrl = item.backdropPath?.let { "$TMDB_IMG_BACKDROP$it" }
            val posterUrl   = item.posterPath?.let { "$TMDB_IMG_POSTER$it" }
            val imageUrl    = backdropUrl ?: posterUrl

            if (imageUrl != null) {
                AsyncImage(
                    model              = imageUrl,
                    contentDescription = item.title,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Box(modifier = Modifier.fillMaxSize().background(colors.paper2))
            }

            // Gradient scrim so the back button is readable — fixed black, theme-independent
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

            // Back button
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

        // Content
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            // Title + meta
            Text(
                text  = item.title,
                style = MaterialTheme.typography.headlineMedium.copy(color = colors.ink),
            )
            Spacer(modifier = Modifier.height(4.dp))
            val meta = listOfNotNull(
                item.year?.toString(),
                item.runtime?.let { "${it}m" },
                if (item.type == "series") "Series" else "Film",
            ).joinToString(" · ")
            if (meta.isNotEmpty()) {
                Text(
                    text  = meta,
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                )
            }

            // Rating
            val rating = item.imdbRating ?: item.voteAverage
            if (rating != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text  = "★ ${"%.1f".format(rating)}",
                    style = MaterialTheme.typography.bodyMedium.copy(color = colors.accent),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Providers
            if (item.providers.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    item.providers.take(3).forEach { provider ->
                        SuggestionChip(
                            onClick = {},
                            label   = { Text(provider, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Status actions
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

            // Overview
            if (!item.overview.isNullOrBlank()) {
                Text(
                    text     = "Overview".uppercase(),
                    style    = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text     = item.overview,
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

            // Genres
            if (item.genres.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text  = "Genres".uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    item.genres.take(4).forEach { genre ->
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
