package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Notes
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.CastMember
import cloud.cinemood.app.data.model.Episode
import cloud.cinemood.app.data.model.ProviderInfo
import cloud.cinemood.app.data.model.Season
import cloud.cinemood.app.data.model.SeasonDetail
import cloud.cinemood.app.data.model.Title
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.data.model.streamingProviders
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_BACKDROP = "https://image.tmdb.org/t/p/w780"
private const val TMDB_POSTER_LG = "https://image.tmdb.org/t/p/w342"

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DetailScreen(
    item: WatchlistItem,
    region: String,
    onBack: () -> Unit,
    onSetStatus: (String) -> Unit,
    api: CinemoodApi? = null,
    onPersonClick: (Int) -> Unit = {},
    onRemove: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors

    // Instant render from cache; upgrade in place once fresh title arrives
    var freshTitle by remember(item.title.id) { mutableStateOf<Title?>(null) }
    val t = freshTitle ?: item.title

    LaunchedEffect(item.title.id) {
        api?.getTitle(item.title.type, item.title.id)?.onSuccess { freshTitle = it }
    }

    var overviewExpanded  by remember { mutableStateOf(false) }
    var currentStatus     by remember(item.status) { mutableStateOf(item.status) }
    var showOverflowMenu  by remember { mutableStateOf(false) }
    var showRemoveConfirm by remember { mutableStateOf(false) }

    // Episode guide state (series only)
    var selectedSeason by remember(item.title.id) { mutableStateOf<Int?>(null) }
    var seasonDetail   by remember(item.title.id) { mutableStateOf<SeasonDetail?>(null) }
    var seasonLoading  by remember { mutableStateOf(false) }

    val backdropUrl = t.backdropPath?.let { "$TMDB_BACKDROP$it" }
    val posterUrl   = t.posterPath?.let { "$TMDB_POSTER_LG$it" }
    val heroUrl     = backdropUrl ?: posterUrl
    val providers   = remember(t, region) { t.streamingProviders(region) }

    // Derived season list — filter specials (season 0), sorted ascending
    val realSeasons: List<Season> = remember(t.seasons) {
        t.seasons?.filter { it.seasonNumber > 0 }?.sortedBy { it.seasonNumber } ?: emptyList()
    }

    // Auto-select first season when seasons become available
    LaunchedEffect(item.title.id, realSeasons.firstOrNull()?.seasonNumber) {
        if (selectedSeason == null && realSeasons.isNotEmpty()) {
            selectedSeason = realSeasons.first().seasonNumber
        }
    }

    // Load episodes whenever selected season changes
    LaunchedEffect(item.title.id, selectedSeason) {
        val season = selectedSeason ?: return@LaunchedEffect
        if (api == null) return@LaunchedEffect
        seasonLoading = true
        seasonDetail  = null
        api.getSeason(item.title.id, season)
            .onSuccess { seasonDetail = it }
        seasonLoading = false
    }

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
                        0f    to Color.Black.copy(alpha = 0.35f),
                        0.45f to Color.Transparent,
                        1f    to Color.Black.copy(alpha = 0.92f),
                    )
                ),
            )

            // Back button — top-left
            IconButton(
                onClick  = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(8.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White)
            }

            // Overflow menu — top-right (only when removal is available)
            if (onRemove != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .statusBarsPadding()
                        .padding(8.dp),
                ) {
                    IconButton(onClick = { showOverflowMenu = true }) {
                        Icon(Icons.Rounded.MoreVert, "More options", tint = Color.White)
                    }
                    DropdownMenu(
                        expanded         = showOverflowMenu,
                        onDismissRequest = { showOverflowMenu = false },
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    "Remove from library",
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        color = MaterialTheme.colorScheme.error,
                                    ),
                                )
                            },
                            onClick = {
                                showOverflowMenu  = false
                                showRemoveConfirm = true
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Rounded.DeleteOutline,
                                    contentDescription = null,
                                    tint               = MaterialTheme.colorScheme.error,
                                    modifier           = Modifier.size(18.dp),
                                )
                            },
                        )
                    }
                }
            }
        }

        // ── Poster-left / Facts-right header ─────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .offset(y = (-40).dp),
            verticalAlignment         = Alignment.Bottom,
            horizontalArrangement     = Arrangement.spacedBy(16.dp),
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
                modifier            = Modifier
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
                    maxLines = 2,
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

                // Meta line: year · runtime · type/seasons
                val typeLabel = if (t.type == "series") {
                    t.numberOfSeasons?.let { "$it seasons" } ?: "Series"
                } else "Film"
                val meta = listOfNotNull(
                    t.releaseDate?.take(4),
                    t.runtime?.let { "${it}m" },
                    typeLabel,
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

                // Genres + OTT providers: genres on the left (wrapping), provider logos right-aligned (horizontal, wrapping)
                if (t.genres.isNotEmpty() || providers.isNotEmpty()) {
                    Row(
                        modifier              = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment     = Alignment.Top,
                    ) {
                        if (t.genres.isNotEmpty()) {
                            FlowRow(
                                modifier              = Modifier.weight(1f),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement   = Arrangement.spacedBy(6.dp),
                            ) {
                                t.genres.forEach { genre -> ThemedChip(genre) }
                            }
                        } else {
                            Spacer(modifier = Modifier.weight(1f))
                        }

                        if (providers.isNotEmpty()) {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
                                verticalArrangement   = Arrangement.spacedBy(6.dp),
                                maxItemsInEachRow     = 4,
                            ) {
                                providers.forEach { info -> ProviderLogoChip(info) }
                            }
                        }
                    }
                }
            }
        }

        // ── Status action row ─────────────────────────────────────────────────
        DetailSection {
            val statusOptions = listOf(
                Triple("pending",  "Want to watch", Icons.Rounded.BookmarkAdd),
                Triple("watching", "Watching",      Icons.Rounded.PlayArrow),
                Triple("watched",  "Watched",       Icons.Rounded.CheckCircle),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.paper2),
            ) {
                statusOptions.forEach { (value, label, icon) ->
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
                            onClick        = {
                                currentStatus = value
                                onSetStatus(value)
                            },
                            modifier       = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Icon(
                                imageVector        = icon,
                                contentDescription = null,
                                modifier           = Modifier.size(14.dp),
                                tint               = if (selected) Color.White else colors.dim,
                            )
                            Spacer(modifier = Modifier.width(4.dp))
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

        // ── Overview ──────────────────────────────────────────────────────────
        if (!t.overview.isNullOrBlank()) {
            DetailSection(label = "Overview", icon = Icons.AutoMirrored.Rounded.Notes) {
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

        // ── Episode guide (series only) ───────────────────────────────────────
        if (t.type == "series" && realSeasons.isNotEmpty()) {
            DetailSection(label = "Episodes", icon = Icons.Rounded.Tv) {
                val effectiveSeason = selectedSeason ?: realSeasons.first().seasonNumber

                // Season selector chips
                if (realSeasons.size > 1) {
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding        = PaddingValues(vertical = 4.dp),
                    ) {
                        items(realSeasons) { s ->
                            val isActive = s.seasonNumber == effectiveSeason
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(if (isActive) colors.accent else colors.paper2)
                                    .clickable { selectedSeason = s.seasonNumber }
                                    .padding(horizontal = 14.dp, vertical = 7.dp),
                            ) {
                                Text(
                                    text  = "S${s.seasonNumber}",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color      = if (isActive) Color.White else colors.dim,
                                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                    ),
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                when {
                    seasonLoading -> {
                        Box(
                            modifier         = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(
                                color       = colors.accent,
                                modifier    = Modifier.size(24.dp),
                                strokeWidth = 2.dp,
                            )
                        }
                    }
                    seasonDetail?.episodes.isNullOrEmpty() -> {
                        Text(
                            text  = "No episodes available",
                            style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                        )
                    }
                    else -> {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            seasonDetail!!.episodes.forEach { ep -> EpisodeRow(ep) }
                        }
                    }
                }
            }
        }

        // ── Cast ──────────────────────────────────────────────────────────────
        if (t.cast.isNotEmpty()) {
            DetailSection(label = "Cast", icon = Icons.Rounded.Groups) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding        = PaddingValues(vertical = 4.dp),
                ) {
                    items(t.cast) { member ->
                        CastCard(member, onClick = { onPersonClick(member.id) })
                    }
                }
            }
        }

        // ── Remove confirm dialog ─────────────────────────────────────────────
        if (showRemoveConfirm) {
            AlertDialog(
                onDismissRequest = { showRemoveConfirm = false },
                title            = { Text("Remove from library?") },
                text             = {
                    Text("This will remove \"${item.title.title}\" from your library. You can always add it again later.")
                },
                confirmButton    = {
                    TextButton(onClick = {
                        showRemoveConfirm = false
                        onRemove?.invoke()
                    }) {
                        Text("Remove", color = MaterialTheme.colorScheme.error)
                    }
                },
                dismissButton    = {
                    TextButton(onClick = { showRemoveConfirm = false }) { Text("Cancel") }
                },
            )
        }

        Spacer(modifier = Modifier.height(120.dp))
    }
}

// ── Sub-composables ───────────────────────────────────────────────────────────

@Composable
private fun DetailSection(
    label: String? = null,
    icon: ImageVector? = null,
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
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                if (icon != null) {
                    Icon(
                        imageVector        = icon,
                        contentDescription = null,
                        modifier           = Modifier.size(14.dp),
                        tint               = colors.faint,
                    )
                }
                Text(
                    text  = label.uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(
                        color         = colors.faint,
                        letterSpacing = 1.sp,
                    ),
                )
            }
        }
        content()
    }
}

@Composable
private fun ThemedChip(label: String) {
    val colors = CinemoodTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(colors.paper2)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text  = label,
            style = MaterialTheme.typography.labelSmall.copy(
                color    = colors.dim,
                fontSize = 10.sp,
            ),
        )
    }
}

@Composable
private fun ProviderLogoChip(info: ProviderInfo) {
    val colors = CinemoodTheme.colors
    Box(
        modifier         = Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(colors.paper2),
        contentAlignment = Alignment.Center,
    ) {
        if (info.logoPath != null) {
            AsyncImage(
                model              = "https://image.tmdb.org/t/p/w92${info.logoPath}",
                contentDescription = info.name,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
            )
        } else {
            Text(
                text  = info.name.take(2).uppercase(),
                style = MaterialTheme.typography.labelSmall.copy(
                    color    = colors.faint,
                    fontSize = 9.sp,
                ),
            )
        }
    }
}

@Composable
private fun CastCard(member: CastMember, onClick: () -> Unit = {}) {
    val colors    = CinemoodTheme.colors
    val clickable = member.id != 0
    Column(
        modifier            = Modifier
            .width(80.dp)
            .then(if (clickable) Modifier.clickable(onClick = onClick) else Modifier),
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
private fun EpisodeRow(ep: Episode) {
    val colors = CinemoodTheme.colors
    var overviewExpanded by remember(ep.episodeNumber) { mutableStateOf(false) }

    Row(
        modifier              = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment     = Alignment.Top,
    ) {
        // Still image (w300 thumbnail)
        Box(
            modifier         = Modifier
                .width(100.dp)
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(6.dp))
                .background(colors.paper2),
            contentAlignment = Alignment.Center,
        ) {
            if (ep.stillPath != null) {
                AsyncImage(
                    model              = "https://image.tmdb.org/t/p/w300${ep.stillPath}",
                    contentDescription = ep.name,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Icon(
                    imageVector        = Icons.Rounded.Tv,
                    contentDescription = null,
                    tint               = colors.faint,
                    modifier           = Modifier.size(20.dp),
                )
            }
        }

        // Metadata
        Column(
            modifier            = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            // Episode number + name
            val label = buildString {
                append("E${ep.episodeNumber}")
                if (!ep.name.isNullOrBlank()) append(" · ${ep.name}")
            }
            Text(
                text     = label,
                style    = MaterialTheme.typography.bodySmall.copy(
                    color      = colors.ink,
                    fontWeight = FontWeight.SemiBold,
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )

            // Air date + runtime
            val meta = listOfNotNull(
                ep.airDate?.take(10),
                ep.runtime?.let { "${it}m" },
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(
                    text  = meta,
                    style = MaterialTheme.typography.labelSmall.copy(
                        color    = colors.dim,
                        fontSize = 10.sp,
                    ),
                )
            }

            // Collapsible overview (tap to expand/collapse)
            if (!ep.overview.isNullOrBlank()) {
                Text(
                    text     = ep.overview,
                    style    = MaterialTheme.typography.bodySmall.copy(
                        color    = colors.faint,
                        fontSize = 11.sp,
                    ),
                    maxLines = if (overviewExpanded) Int.MAX_VALUE else 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable { overviewExpanded = !overviewExpanded },
                )
            }
        }
    }
}
