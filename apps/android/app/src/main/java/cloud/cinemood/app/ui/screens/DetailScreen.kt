package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.model.CastMember
import cloud.cinemood.app.data.model.ProviderInfo
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.data.model.streamingProviders
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_BACKDROP = "https://image.tmdb.org/t/p/w780"
private const val TMDB_POSTER_LG = "https://image.tmdb.org/t/p/w342"

@Composable
fun DetailScreen(
    item: WatchlistItem,
    region: String,
    onBack: () -> Unit,
    onSetStatus: (String) -> Unit,
    onRemove: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors
    val t = item.title

    var overviewExpanded by remember { mutableStateOf(false) }
    var currentStatus by remember(item.status) { mutableStateOf(item.status) }

    val backdropUrl = t.backdropPath?.let { "$TMDB_BACKDROP$it" }
    val posterUrl   = t.posterPath?.let { "$TMDB_POSTER_LG$it" }
    val heroUrl     = backdropUrl ?: posterUrl

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.paper)
            .verticalScroll(rememberScrollState()),
    ) {
        // ── Full-bleed backdrop ───────────────────────────────────────────────
        Box(modifier = Modifier.fillMaxWidth().height(300.dp)) {
            if (heroUrl != null) {
                AsyncImage(
                    model              = heroUrl,
                    contentDescription = t.title,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Box(modifier = Modifier.fillMaxSize().background(colors.paper2))
            }

            Box(
                modifier = Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        0f   to Color.Black.copy(alpha = 0.35f),
                        0.45f to Color.Transparent,
                        1f   to Color.Black.copy(alpha = 0.92f),
                    )
                ),
            )

            IconButton(
                onClick  = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(8.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White)
            }
        }

        // ── Poster-left / Facts-right header ─────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .offset(y = (-40).dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Poster thumbnail
            if (posterUrl != null) {
                AsyncImage(
                    model              = posterUrl,
                    contentDescription = null,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier
                        .width(110.dp)
                        .height(165.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .shadow(8.dp, RoundedCornerShape(12.dp)),
                )
            } else {
                Box(
                    modifier = Modifier
                        .width(110.dp)
                        .height(165.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(colors.paper2),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text  = t.title.take(2).uppercase(),
                        style = MaterialTheme.typography.headlineMedium.copy(color = colors.faint),
                    )
                }
            }

            // Facts column
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text     = t.title,
                    style    = MaterialTheme.typography.headlineMedium.copy(
                        color      = colors.ink,
                        lineHeight = 30.sp,
                    ),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )

                if (!t.originalTitle.isNullOrBlank() && t.originalTitle != t.title) {
                    Text(
                        text     = t.originalTitle,
                        style    = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                // Meta line: year · runtime · type
                val meta = listOfNotNull(
                    t.releaseDate?.take(4),
                    t.runtime?.let { "${it}m" },
                    if (t.type == "series") "Series" else "Film",
                ).joinToString(" · ")
                if (meta.isNotEmpty()) {
                    Text(
                        text  = meta,
                        style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                    )
                }

                // Ratings row
                val tmdb = t.voteAverage
                val imdb = t.imdbRating
                if (tmdb != null || imdb != null) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                    ) {
                        if (tmdb != null) {
                            Column {
                                Text(
                                    text  = "★ ${"%.1f".format(tmdb)}",
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        color      = colors.accent,
                                        fontWeight = FontWeight.Bold,
                                    ),
                                )
                                val cnt = t.voteCount
                                if (cnt != null) {
                                    Text(
                                        text  = "${(cnt / 1000)}K votes",
                                        style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                                    )
                                }
                            }
                        }
                        if (imdb != null) {
                            Column {
                                Text(
                                    text  = "★ ${"%.1f".format(imdb)}",
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        color      = Color(0xFFF5C518),
                                        fontWeight = FontWeight.Bold,
                                    ),
                                )
                                Text(
                                    text  = "IMDb",
                                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                                )
                            }
                        }
                    }
                }
            }
        }

        // ── Status action row ─────────────────────────────────────────────────
        DetailSection {
            val statusOptions = listOf(
                "pending"  to "Want to watch",
                "watching" to "Watching",
                "watched"  to "Watched",
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.paper2),
            ) {
                statusOptions.forEach { (value, label) ->
                    val selected = currentStatus == value
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selected) colors.accent else Color.Transparent)
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        TextButton(
                            onClick = {
                                currentStatus = value
                                onSetStatus(value)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Text(
                                text  = label,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color      = if (selected) Color.White else colors.dim,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    fontSize   = 11.sp,
                                ),
                            )
                        }
                    }
                }
            }
        }

        // ── Where to watch ────────────────────────────────────────────────────
        val providers = t.streamingProviders(region)
        if (providers.isNotEmpty()) {
            DetailSection(label = "Where to watch") {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding        = PaddingValues(vertical = 4.dp),
                ) {
                    items(providers) { info ->
                        ProviderCard(info)
                    }
                }
            }
        }

        // ── Overview ──────────────────────────────────────────────────────────
        if (!t.overview.isNullOrBlank()) {
            DetailSection(label = "Overview") {
                Text(
                    text     = t.overview,
                    style    = MaterialTheme.typography.bodyMedium.copy(
                        color      = colors.ink,
                        lineHeight = 22.sp,
                    ),
                    maxLines = if (overviewExpanded) Int.MAX_VALUE else 4,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!overviewExpanded) {
                    TextButton(
                        onClick        = { overviewExpanded = true },
                        contentPadding = PaddingValues(0.dp),
                    ) {
                        Text(
                            "Show more",
                            style = MaterialTheme.typography.labelSmall.copy(color = colors.accent),
                        )
                    }
                }
            }
        }

        // ── Cast ──────────────────────────────────────────────────────────────
        if (t.cast.isNotEmpty()) {
            DetailSection(label = "Cast") {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding        = PaddingValues(vertical = 4.dp),
                ) {
                    items(t.cast) { member ->
                        CastCard(member)
                    }
                }
            }
        }

        // ── Genres ────────────────────────────────────────────────────────────
        if (t.genres.isNotEmpty()) {
            DetailSection(label = "Genres") {
                Row(
                    modifier              = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    t.genres.forEach { genre ->
                        ThemedChip(genre)
                    }
                }
            }
        }

        // ── Remove from library ───────────────────────────────────────────────
        if (onRemove != null) {
            var showConfirm by remember { mutableStateOf(false) }
            Box(
                modifier         = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                TextButton(
                    onClick = { showConfirm = true },
                ) {
                    Text(
                        "Remove from library",
                        style = MaterialTheme.typography.labelMedium.copy(
                            color = MaterialTheme.colorScheme.error,
                        ),
                    )
                }
            }
            if (showConfirm) {
                AlertDialog(
                    onDismissRequest = { showConfirm = false },
                    title            = { Text("Remove from library?") },
                    text             = { Text("This will remove \"${item.title.title}\" from your library. You can always add it again later.") },
                    confirmButton    = {
                        TextButton(onClick = {
                            showConfirm = false
                            onRemove()
                        }) {
                            Text("Remove", color = MaterialTheme.colorScheme.error)
                        }
                    },
                    dismissButton    = {
                        TextButton(onClick = { showConfirm = false }) { Text("Cancel") }
                    },
                )
            }
        }

        Spacer(modifier = Modifier.height(120.dp))
    }
}

// ── Sub-composables ───────────────────────────────────────────────────────────

@Composable
private fun DetailSection(
    label: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = CinemoodTheme.colors
    Column(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (label != null) {
            Text(
                text  = label.uppercase(),
                style = MaterialTheme.typography.labelSmall.copy(
                    color         = colors.faint,
                    letterSpacing = 1.sp,
                ),
            )
        }
        content()
    }
}

@Composable
private fun ThemedChip(label: String) {
    val colors = CinemoodTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(colors.paper2)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            text  = label,
            style = MaterialTheme.typography.bodySmall.copy(color = colors.ink),
        )
    }
}

@Composable
private fun CastCard(member: CastMember) {
    val colors = CinemoodTheme.colors
    Column(
        modifier            = Modifier.width(80.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier         = Modifier
                .size(76.dp)
                .clip(CircleShape)
                .background(colors.paper2),
            contentAlignment = Alignment.Center,
        ) {
            if (member.profilePath != null) {
                AsyncImage(
                    model              = "https://image.tmdb.org/t/p/w185${member.profilePath}",
                    contentDescription = member.name,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Text(
                    text  = member.name.take(2).uppercase(),
                    style = MaterialTheme.typography.titleSmall.copy(color = colors.accent),
                )
            }
        }
        Text(
            text      = member.name,
            style     = MaterialTheme.typography.labelSmall.copy(
                color    = colors.ink,
                fontSize = 10.sp,
            ),
            maxLines  = 2,
            overflow  = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier  = Modifier.fillMaxWidth(),
        )
        if (!member.character.isNullOrBlank()) {
            Text(
                text      = member.character,
                style     = MaterialTheme.typography.labelSmall.copy(
                    color    = colors.faint,
                    fontSize = 9.sp,
                ),
                maxLines  = 1,
                overflow  = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier  = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun ProviderCard(info: ProviderInfo) {
    val colors = CinemoodTheme.colors
    Column(
        modifier            = Modifier.width(64.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier         = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(colors.paper2),
            contentAlignment = Alignment.Center,
        ) {
            if (info.logoPath != null) {
                AsyncImage(
                    model              = "https://image.tmdb.org/t/p/w92${info.logoPath}",
                    contentDescription = info.name,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)),
                )
            } else {
                Text(
                    text  = info.name.take(2).uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
            }
        }
        Text(
            text      = info.name,
            style     = MaterialTheme.typography.labelSmall.copy(
                color    = colors.dim,
                fontSize = 9.sp,
            ),
            maxLines  = 2,
            overflow  = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier  = Modifier.fillMaxWidth(),
        )
    }
}
