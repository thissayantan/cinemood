package cloud.cinemood.app.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.TmdbResult
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.theme.CinemoodTheme

private const val TMDB_POSTER_SM = "https://image.tmdb.org/t/p/w185"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareReceiveSheet(
    api:       CinemoodApi,
    title:     String,
    onAdded:   (WatchlistItem) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors  = CinemoodTheme.colors
    val context = LocalContext.current

    var results   by remember { mutableStateOf<List<TmdbResult>?>(null) }
    var loading   by remember { mutableStateOf(true) }
    var addedIds  by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var addingId  by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(title) {
        loading = true
        results = api.searchTmdb(title).getOrDefault(emptyList()).take(5)
        loading = false
    }

    ModalBottomSheet(
        onDismissRequest    = onDismiss,
        containerColor      = colors.paper,
        contentColor        = colors.ink,
        shape               = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle          = { BottomSheetDefaults.DragHandle(color = colors.rule) },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
        ) {
            Text(
                text  = "Add to Watchlist",
                style = MaterialTheme.typography.titleMedium.copy(
                    color      = colors.ink,
                    fontWeight = FontWeight.Bold,
                ),
                modifier = Modifier.padding(bottom = 4.dp),
            )
            Text(
                text  = "\"$title\"",
                style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                modifier = Modifier.padding(bottom = 16.dp),
            )

            when {
                loading -> {
                    Box(
                        modifier         = Modifier.fillMaxWidth().height(120.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = colors.accent, modifier = Modifier.size(28.dp), strokeWidth = 2.5.dp)
                    }
                }
                results.isNullOrEmpty() -> {
                    Column(
                        modifier            = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(Icons.Rounded.SearchOff, null, tint = colors.faint, modifier = Modifier.size(36.dp))
                        Text(
                            text  = "No results found for \"$title\"",
                            style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
                        )
                    }
                }
                else -> {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(results!!, key = { it.id }) { item ->
                            ShareResultRow(
                                item     = item,
                                added    = addedIds.contains(item.id),
                                adding   = addingId == item.id,
                                onAdd    = {
                                    if (addingId != null) return@ShareResultRow
                                    addingId = item.id
                                    // optimistic
                                    addedIds = addedIds + item.id
                                    // fire-and-forget; MainActivity handles the rest via onAdded
                                },
                                onAdded  = { wli ->
                                    addingId = null
                                    Toast.makeText(context, "Added to watchlist", Toast.LENGTH_SHORT).show()
                                    onAdded(wli)
                                },
                                onFailed = {
                                    addingId = null
                                    addedIds = addedIds - item.id
                                    Toast.makeText(context, "Failed to add. Please try again.", Toast.LENGTH_SHORT).show()
                                },
                                api      = api,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShareResultRow(
    item:     TmdbResult,
    added:    Boolean,
    adding:   Boolean,
    onAdd:    () -> Unit,
    onAdded:  (WatchlistItem) -> Unit,
    onFailed: () -> Unit,
    api:      CinemoodApi,
) {
    val colors = CinemoodTheme.colors

    // Trigger the actual network call when this row becomes "adding"
    LaunchedEffect(adding) {
        if (adding) {
            api.addToWatchlist(item.id, item.type).fold(
                onSuccess = { onAdded(it) },
                onFailure = { onFailed() },
            )
        }
    }

    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.paper2)
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        // Poster
        Box(
            modifier         = Modifier
                .size(width = 40.dp, height = 58.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(colors.rule),
            contentAlignment = Alignment.Center,
        ) {
            if (item.posterPath != null) {
                AsyncImage(
                    model              = "$TMDB_POSTER_SM${item.posterPath}",
                    contentDescription = null,
                    contentScale       = ContentScale.Crop,
                    modifier           = Modifier.fillMaxSize(),
                )
            } else {
                Text(
                    item.title.take(2).uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
            }
        }

        // Info
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text     = item.title,
                style    = MaterialTheme.typography.bodyMedium.copy(color = colors.ink, fontWeight = FontWeight.Medium),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val meta = listOfNotNull(
                item.releaseDate?.take(4),
                if (item.type == "series") "Series" else "Film",
                item.voteAverage?.let { "★ ${"%.1f".format(it)}" },
            ).joinToString(" · ")
            Text(
                text  = meta,
                style = MaterialTheme.typography.labelSmall.copy(color = colors.faint, fontSize = 10.sp),
            )
        }

        // Action
        when {
            added   -> Icon(Icons.Rounded.CheckCircle, null, tint = Color(0xFF34A853), modifier = Modifier.size(28.dp))
            adding  -> CircularProgressIndicator(color = colors.accent, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
            else    -> FilledTonalIconButton(
                onClick  = onAdd,
                modifier = Modifier.size(44.dp),
                shape    = RoundedCornerShape(10.dp),
                colors   = IconButtonDefaults.filledTonalIconButtonColors(
                    containerColor = colors.accent.copy(alpha = 0.12f),
                    contentColor   = colors.accent,
                ),
            ) {
                Icon(Icons.Rounded.Add, "Add to watchlist", modifier = Modifier.size(22.dp))
            }
        }
    }
}
