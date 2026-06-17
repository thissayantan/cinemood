package cloud.cinemood.app.ui.screens.decide

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.screens.CinemoodChip
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_POSTER = "https://image.tmdb.org/t/p/w185"

@Composable
fun MoodPickerSection(
    vm:          DecideViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    onBack:      () -> Unit,
    modifier:    Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors

    val result    = vm.moodResult
    val recById   = result?.recommendations?.associateBy { it.titleId } ?: emptyMap()
    val items     = result?.items ?: emptyList()

    LazyColumn(
        modifier        = modifier.fillMaxSize().statusBarsPadding(),
        contentPadding  = PaddingValues(bottom = 120.dp),
    ) {
        // ── Header ─────────────────────────────────────────────────────────────
        item {
            Row(
                modifier          = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = colors.ink)
                }
                Text(
                    text  = "Mood picker",
                    style = MaterialTheme.typography.titleMedium.copy(
                        color      = colors.ink,
                        fontWeight = FontWeight.Bold,
                    ),
                )
            }
        }

        // ── Form ───────────────────────────────────────────────────────────────
        item {
            Column(
                modifier            = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value            = vm.mood,
                    onValueChange    = { vm.mood = it },
                    label            = { Text("How are you feeling tonight?") },
                    placeholder      = { Text("e.g. cozy Sunday evening, want something light") },
                    modifier         = Modifier.fillMaxWidth(),
                    minLines         = 2,
                    maxLines         = 4,
                    shape            = RoundedCornerShape(12.dp),
                    colors           = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor   = colors.accent,
                        unfocusedBorderColor = colors.rule,
                        focusedLabelColor    = colors.accent,
                    ),
                )

                // Status filter
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf(null to "All", "pending" to "To watch", "watching" to "Watching").forEach { (v, l) ->
                        CinemoodChip(
                            label    = l,
                            selected = vm.moodStatus == v,
                            onClick  = { vm.moodStatus = v },
                        )
                    }
                }

                Button(
                    onClick  = { vm.runMood() },
                    enabled  = vm.mood.isNotBlank() && !vm.moodLoading,
                    modifier = Modifier.fillMaxWidth(),
                    shape    = RoundedCornerShape(12.dp),
                    colors   = ButtonDefaults.buttonColors(containerColor = colors.accent),
                ) {
                    if (vm.moodLoading) {
                        CircularProgressIndicator(
                            color    = Color.White,
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Finding…")
                    } else {
                        Text("Find for me")
                    }
                }

                vm.moodError?.let { err ->
                    Text(
                        text  = err,
                        style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.error),
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        // ── Results ────────────────────────────────────────────────────────────
        if (items.isNotEmpty()) {
            item {
                Text(
                    text     = "Your picks",
                    style    = MaterialTheme.typography.titleMedium.copy(color = colors.ink),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
            }
            itemsIndexed(items) { index, item ->
                val rec = recById[item.title.id]
                RecommendationRow(
                    rank     = index + 1,
                    item     = item,
                    reason   = rec?.reason,
                    onClick  = { onItemClick(item) },
                )
                if (index < items.lastIndex) {
                    HorizontalDivider(
                        modifier  = Modifier.padding(horizontal = 20.dp),
                        color     = colors.rule,
                        thickness = 0.5.dp,
                    )
                }
            }
            item {
                TextButton(
                    onClick  = { vm.resetMood() },
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                ) {
                    Text("Try another mood", color = colors.dim)
                }
            }
        }
    }
}

@Composable
private fun RecommendationRow(
    rank:    Int,
    item:    WatchlistItem,
    reason:  String?,
    onClick: () -> Unit,
) {
    val colors = CinemoodTheme.colors
    val t      = item.title

    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        // Rank badge
        Box(
            modifier         = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(colors.accent.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text  = "$rank",
                style = MaterialTheme.typography.labelSmall.copy(
                    color      = colors.accent,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }

        // Poster
        if (t.posterPath != null) {
            AsyncImage(
                model              = "$TMDB_POSTER${t.posterPath}",
                contentDescription = null,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier
                    .size(width = 44.dp, height = 66.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.paper2),
            )
        } else {
            Box(
                modifier         = Modifier
                    .size(width = 44.dp, height = 66.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.paper2),
                contentAlignment = Alignment.Center,
            ) {
                Text(t.title.take(2).uppercase(), style = MaterialTheme.typography.labelSmall.copy(color = colors.faint))
            }
        }

        Column(
            modifier            = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text     = t.title,
                style    = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val meta = listOfNotNull(
                t.releaseDate?.take(4),
                if (t.type == "series") "Series" else "Film",
            ).joinToString(" · ")
            Text(
                text  = meta,
                style = MaterialTheme.typography.labelSmall.copy(color = colors.faint, fontSize = 10.sp),
            )
            if (!reason.isNullOrBlank()) {
                Text(
                    text     = reason,
                    style    = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        TextButton(onClick = onClick, contentPadding = PaddingValues(8.dp)) {
            Text("View", style = MaterialTheme.typography.labelSmall.copy(color = colors.accent))
        }
    }
}
