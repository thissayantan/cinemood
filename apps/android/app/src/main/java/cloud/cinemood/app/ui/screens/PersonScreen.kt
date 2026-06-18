package cloud.cinemood.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.rounded.LocalMovies
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import cloud.cinemood.app.data.model.PersonCredit
import cloud.cinemood.app.data.model.PersonDetail
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_PROFILE = "https://image.tmdb.org/t/p/w342"
private const val TMDB_POSTER  = "https://image.tmdb.org/t/p/w185"

@Composable
fun PersonScreen(
    api: CinemoodApi,
    personId: Int,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors

    var person   by remember(personId) { mutableStateOf<PersonDetail?>(null) }
    var loading  by remember(personId) { mutableStateOf(true) }
    var hasError by remember(personId) { mutableStateOf(false) }
    var bioExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(personId) {
        loading  = true
        hasError = false
        api.getPerson(personId)
            .onSuccess { person = it; loading = false }
            .onFailure { hasError = true; loading = false }
    }

    Box(modifier = modifier.fillMaxSize().background(colors.paper)) {
        when {
            loading -> {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color    = colors.accent,
                )
            }
            hasError || person == null -> {
                Column(
                    modifier            = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text  = "Could not load actor info",
                        style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
                    )
                    TextButton(onClick = onBack) {
                        Text("Go back", style = MaterialTheme.typography.labelMedium.copy(color = colors.accent))
                    }
                }
                // Back button still visible at top
                IconButton(
                    onClick  = onBack,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .statusBarsPadding()
                        .padding(8.dp),
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = colors.ink)
                }
            }
            else -> {
                val p = person!!
                val profileUrl = p.profilePath?.let { "$TMDB_PROFILE$it" }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                ) {
                    // ── Hero photo ────────────────────────────────────────────
                    Box(modifier = Modifier.fillMaxWidth().height(320.dp)) {
                        if (profileUrl != null) {
                            AsyncImage(
                                model              = profileUrl,
                                contentDescription = p.name,
                                contentScale       = ContentScale.Crop,
                                modifier           = Modifier.fillMaxSize(),
                            )
                        } else {
                            Box(
                                modifier         = Modifier
                                    .fillMaxSize()
                                    .background(colors.paper2),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text  = p.name.take(2).uppercase(),
                                    style = MaterialTheme.typography.displaySmall.copy(color = colors.faint),
                                )
                            }
                        }

                        // Gradient scrim
                        Box(
                            modifier = Modifier.fillMaxSize().background(
                                Brush.verticalGradient(
                                    0f    to Color.Black.copy(alpha = 0.3f),
                                    0.5f  to Color.Transparent,
                                    1f    to Color.Black.copy(alpha = 0.85f),
                                )
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
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White)
                        }

                        // Name + meta at the bottom of the hero
                        Column(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(horizontal = 20.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                text  = p.name,
                                style = MaterialTheme.typography.headlineMedium.copy(
                                    color      = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    lineHeight = 30.sp,
                                ),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            // Known-for · birthplace · birth year
                            val meta = listOfNotNull(
                                p.knownForDepartment,
                                p.placeOfBirth?.let { it.split(",").lastOrNull()?.trim() },
                                p.birthday?.take(4),
                            ).joinToString(" · ")
                            if (meta.isNotEmpty()) {
                                Text(
                                    text  = meta,
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = Color.White.copy(alpha = 0.8f),
                                    ),
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }

                    // ── Biography ─────────────────────────────────────────────
                    if (!p.biography.isNullOrBlank()) {
                        PersonSection(label = "Biography", icon = Icons.Rounded.Person) {
                            Text(
                                text     = p.biography,
                                style    = MaterialTheme.typography.bodyMedium.copy(
                                    color      = colors.ink,
                                    lineHeight = 22.sp,
                                ),
                                maxLines = if (bioExpanded) Int.MAX_VALUE else 5,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (!bioExpanded) {
                                TextButton(
                                    onClick        = { bioExpanded = true },
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

                    // ── Filmography rail ──────────────────────────────────────
                    if (p.credits.isNotEmpty()) {
                        PersonSection(label = "Known for", icon = Icons.Rounded.LocalMovies) {
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                contentPadding        = PaddingValues(vertical = 4.dp),
                            ) {
                                items(p.credits) { credit ->
                                    FilmCard(credit)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(120.dp))
                }
            }
        }
    }
}

// ── Private sub-composables ───────────────────────────────────────────────────

@Composable
private fun PersonSection(
    label: String,
    icon: ImageVector? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = CinemoodTheme.colors
    Column(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(top = 20.dp, bottom = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
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
        content()
    }
}

@Composable
private fun FilmCard(credit: PersonCredit) {
    val colors = CinemoodTheme.colors
    Column(
        modifier            = Modifier.width(110.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // Poster (2:3 aspect)
        Box(
            modifier         = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(10.dp))
                .background(colors.paper2),
            contentAlignment = Alignment.Center,
        ) {
            if (credit.posterPath != null) {
                AsyncImage(
                    model              = "$TMDB_POSTER${credit.posterPath}",
                    contentDescription = credit.title,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Text(
                    text  = credit.title.take(2).uppercase(),
                    style = MaterialTheme.typography.titleSmall.copy(color = colors.faint),
                )
            }

            // Year chip on the poster
            val year = credit.releaseDate?.take(4)
            if (year != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(6.dp)
                        .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                ) {
                    Text(
                        text  = year,
                        style = MaterialTheme.typography.labelSmall.copy(color = Color.White),
                    )
                }
            }
        }

        Text(
            text     = credit.title,
            style    = MaterialTheme.typography.bodySmall.copy(
                color    = colors.ink,
                fontSize = 11.sp,
            ),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        if (!credit.character.isNullOrBlank()) {
            Text(
                text     = credit.character,
                style    = MaterialTheme.typography.labelSmall.copy(
                    color    = colors.faint,
                    fontSize = 9.sp,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
