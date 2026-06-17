package cloud.cinemood.app.ui.screens

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
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
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.theme.CinemoodTheme
import kotlinx.coroutines.launch

private const val TMDB_POSTER = "https://image.tmdb.org/t/p/w185"

// ── ViewModel ─────────────────────────────────────────────────────────────────

sealed interface AssistantState {
    data object Idle      : AssistantState
    data object Listening : AssistantState
    data object Searching : AssistantState
    data class Results(val hits: List<WatchlistItem>) : AssistantState
    data class NoResults(val query: String)           : AssistantState
    data class Error(val message: String)             : AssistantState
}

class AssistantViewModel(private val api: CinemoodApi) : ViewModel() {

    var state by mutableStateOf<AssistantState>(AssistantState.Idle)
    var query by mutableStateOf("")

    val addedIds = mutableSetOf<Int>()

    fun search(q: String) {
        if (q.isBlank()) return
        query = q
        viewModelScope.launch {
            state = AssistantState.Searching
            api.nlSearch(q).fold(
                onSuccess = { result ->
                    state = if (result.hits.isEmpty()) AssistantState.NoResults(q)
                            else AssistantState.Results(result.hits)
                },
                onFailure = { state = AssistantState.Error(it.message ?: "Search failed") },
            )
        }
    }

    fun add(item: WatchlistItem) {
        if (addedIds.contains(item.title.id)) return
        viewModelScope.launch {
            api.addToWatchlist(item.title.id, item.title.type).onSuccess {
                addedIds.add(item.title.id)
            }
        }
    }

    fun reset() {
        state = AssistantState.Idle
        query = ""
        addedIds.clear()
    }
}

// ── Bottom sheet ───────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssistantSheet(
    vm:          AssistantViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    onDismiss:   () -> Unit,
) {
    val colors  = CinemoodTheme.colors
    val context = LocalContext.current

    // Voice recognition launcher
    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val matches = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val transcript = matches?.firstOrNull() ?: return@rememberLauncherForActivityResult
            vm.search(transcript)
        }
    }

    // Mic permission launcher — falls through to text input on denial
    val micPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PROMPT, "What do you want to watch?")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            speechLauncher.launch(intent)
        }
    }

    fun launchVoice() {
        val hasPerm = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (hasPerm) {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PROMPT, "What do you want to watch?")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            speechLauncher.launch(intent)
        } else {
            micPermLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            vm.reset()
            onDismiss()
        },
        containerColor = colors.paper,
        contentColor   = colors.ink,
        dragHandle     = { BottomSheetDefaults.DragHandle(color = colors.rule) },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text  = "Find something to watch",
                style = MaterialTheme.typography.titleMedium.copy(
                    color      = colors.ink,
                    fontWeight = FontWeight.Bold,
                ),
            )

            // Search bar
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment     = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value         = vm.query,
                    onValueChange = { vm.query = it },
                    modifier      = Modifier.weight(1f),
                    placeholder   = { Text("e.g. \"something like Arrival\" or \"Park Chan-wook films\"") },
                    singleLine    = true,
                    shape         = RoundedCornerShape(12.dp),
                    colors        = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor   = colors.accent,
                        unfocusedBorderColor = colors.rule,
                    ),
                    trailingIcon  = {
                        if (vm.state is AssistantState.Searching) {
                            CircularProgressIndicator(
                                color    = colors.accent,
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                            )
                        } else if (vm.query.isNotBlank()) {
                            IconButton(onClick = { vm.search(vm.query) }) {
                                Icon(Icons.Rounded.Search, null, tint = colors.accent)
                            }
                        }
                    },
                )

                // Mic button
                FilledIconButton(
                    onClick  = { launchVoice() },
                    shape    = RoundedCornerShape(12.dp),
                    colors   = IconButtonDefaults.filledIconButtonColors(
                        containerColor = colors.accent,
                        contentColor   = Color.White,
                    ),
                ) {
                    Icon(Icons.Rounded.Mic, "Search by voice")
                }
            }

            // Results / states
            when (val s = vm.state) {
                is AssistantState.Idle -> {
                    Text(
                        text  = "Speak or type to search your library and discover new titles.",
                        style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                    )
                }

                is AssistantState.Listening, is AssistantState.Searching -> {
                    Box(
                        modifier         = Modifier.fillMaxWidth().height(80.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = colors.accent)
                    }
                }

                is AssistantState.Results -> {
                    LazyColumn(
                        modifier       = Modifier.heightIn(max = 400.dp),
                        verticalArrangement = Arrangement.spacedBy(0.dp),
                    ) {
                        items(s.hits, key = { it.title.id }) { item ->
                            AssistantResultRow(
                                item      = item,
                                added     = vm.addedIds.contains(item.title.id),
                                onAdd     = { vm.add(item) },
                                onTap     = { onItemClick(item); vm.reset(); onDismiss() },
                            )
                            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)
                        }
                    }
                }

                is AssistantState.NoResults -> {
                    Text(
                        text  = "Nothing found for \"${s.query}\". Try rephrasing or use different keywords.",
                        style = MaterialTheme.typography.bodySmall.copy(color = colors.faint),
                    )
                }

                is AssistantState.Error -> {
                    Text(
                        text  = s.message,
                        style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.error),
                    )
                }
            }
        }
    }
}

@Composable
private fun AssistantResultRow(
    item:  WatchlistItem,
    added: Boolean,
    onAdd: () -> Unit,
    onTap: () -> Unit,
) {
    val colors = CinemoodTheme.colors
    val t      = item.title

    Row(
        modifier              = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        if (t.posterPath != null) {
            AsyncImage(
                model              = "$TMDB_POSTER${t.posterPath}",
                contentDescription = null,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier
                    .size(width = 40.dp, height = 60.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.paper2),
            )
        } else {
            Box(
                modifier         = Modifier
                    .size(width = 40.dp, height = 60.dp)
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
                (t.imdbRating ?: t.voteAverage)?.let { "★ ${"%.1f".format(it)}" },
            ).joinToString(" · ")
            Text(
                text  = meta,
                style = MaterialTheme.typography.labelSmall.copy(color = colors.faint, fontSize = 10.sp),
            )
        }

        // Add or view
        if (added) {
            Icon(Icons.Rounded.CheckCircle, null, tint = Color(0xFF34A853), modifier = Modifier.size(20.dp))
        } else {
            TextButton(
                onClick = onAdd,
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Icon(Icons.Rounded.Add, null, tint = colors.accent, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add", style = MaterialTheme.typography.labelSmall.copy(color = colors.accent))
            }
        }

        TextButton(
            onClick = onTap,
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
        ) {
            Text("View", style = MaterialTheme.typography.labelSmall.copy(color = colors.dim, fontSize = 11.sp))
        }
    }
}
