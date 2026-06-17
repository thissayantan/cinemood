package cloud.cinemood.app.ui.screens.decide

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.ui.theme.CinemoodTheme
import cloud.cinemood.app.ui.util.rememberReducedMotion
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

private const val TMDB_POSTER = "https://image.tmdb.org/t/p/w342"

@Composable
fun SwipeDeckSection(
    vm:          DecideViewModel,
    onItemClick: (WatchlistItem) -> Unit,
    onBack:      () -> Unit,
    modifier:    Modifier = Modifier,
) {
    val colors  = CinemoodTheme.colors
    val reduced = rememberReducedMotion()

    Box(modifier = modifier.fillMaxSize().statusBarsPadding()) {
        Crossfade(targetState = vm.swipePhase, label = "swipePhase") { phase ->
            when (phase) {
                is SwipePhase.Idle, is SwipePhase.Loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            CircularProgressIndicator(color = colors.accent)
                            Text(
                                "Preparing your questions…",
                                style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
                            )
                        }
                    }
                }

                is SwipePhase.Questions -> {
                    QuestionsView(
                        phase   = phase,
                        reduced = reduced,
                        onAnswer = { qId, oId -> vm.answer(qId, oId) },
                        onBack  = onBack,
                    )
                }

                is SwipePhase.Picking -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            CircularProgressIndicator(color = colors.accent)
                            Text(
                                "Finding your perfect watch…",
                                style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
                            )
                        }
                    }
                }

                is SwipePhase.Result -> {
                    ResultView(
                        phase       = phase,
                        onItemClick = onItemClick,
                        onTryAgain  = { vm.resetSwipe(); vm.startSwipe() },
                        onDone      = onBack,
                    )
                }

                is SwipePhase.Error -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            modifier            = Modifier.padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Text(
                                phase.message,
                                style = MaterialTheme.typography.bodyMedium.copy(color = colors.faint),
                            )
                            Button(
                                onClick = { vm.startSwipe() },
                                colors  = ButtonDefaults.buttonColors(containerColor = colors.accent),
                                shape   = RoundedCornerShape(12.dp),
                            ) { Text("Try again") }
                            TextButton(onClick = onBack) { Text("Go back", color = colors.dim) }
                        }
                    }
                }
            }
        }

        // Back button (only show on landing / question views)
        if (vm.swipePhase is SwipePhase.Questions) {
            IconButton(
                onClick  = onBack,
                modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = colors.ink)
            }
        }
    }
}

@Composable
private fun QuestionsView(
    phase:    SwipePhase.Questions,
    reduced:  Boolean,
    onAnswer: (String, String) -> Unit,
    onBack:   () -> Unit,
) {
    val colors    = CinemoodTheme.colors
    val question  = phase.questions[phase.index]
    val total     = phase.questions.size
    val isBinary  = question.options.size == 2

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 56.dp, bottom = 120.dp)
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        // Progress dots
        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
        ) {
            repeat(total) { i ->
                Box(
                    modifier = Modifier
                        .padding(horizontal = 4.dp)
                        .size(
                            width  = if (i == phase.index) 24.dp else 8.dp,
                            height = 8.dp,
                        )
                        .clip(CircleShape)
                        .background(
                            when {
                                i < phase.index  -> colors.accent
                                i == phase.index -> colors.ink
                                else             -> colors.rule
                            }
                        ),
                )
            }
        }

        Text(
            text  = "Question ${phase.index + 1} of $total",
            style = MaterialTheme.typography.labelSmall.copy(color = colors.faint, letterSpacing = 1.sp),
        )

        // Question card (swipeable if binary + not reduced-motion)
        QuestionCard(
            question  = question,
            isBinary  = isBinary,
            reduced   = reduced,
            onAnswer  = onAnswer,
        )
    }
}

@Composable
private fun QuestionCard(
    question: cloud.cinemood.app.data.model.SwipeQuestion,
    isBinary: Boolean,
    reduced:  Boolean,
    onAnswer: (String, String) -> Unit,
) {
    val colors      = CinemoodTheme.colors
    val scope       = rememberCoroutineScope()
    val density     = LocalDensity.current
    val thresholdPx = with(density) { 100.dp.toPx() }
    val offsetX     = remember(question.id) { Animatable(0f) }

    val swipeEnabled = isBinary && !reduced

    Column(
        modifier            = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(colors.paper2)
                .then(
                    if (swipeEnabled) {
                        Modifier
                            .offset { IntOffset(offsetX.value.roundToInt(), 0) }
                            .graphicsLayer {
                                rotationZ = (offsetX.value / thresholdPx).coerceIn(-1f, 1f) * 6f
                            }
                            .pointerInput(question.id) {
                                detectHorizontalDragGestures(
                                    onDragEnd = {
                                        when {
                                            offsetX.value > thresholdPx ->
                                                onAnswer(question.id, question.options.last().id)
                                            offsetX.value < -thresholdPx ->
                                                onAnswer(question.id, question.options.first().id)
                                            else -> scope.launch { offsetX.animateTo(0f, spring()) }
                                        }
                                    },
                                    onHorizontalDrag = { _, dx ->
                                        scope.launch { offsetX.snapTo(offsetX.value + dx) }
                                    },
                                )
                            }
                    } else Modifier
                )
                .padding(24.dp),
        ) {
            Text(
                text  = question.prompt,
                style = MaterialTheme.typography.titleLarge.copy(
                    color      = colors.ink,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 28.sp,
                ),
            )
        }

        if (swipeEnabled) {
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "← ${question.options.firstOrNull()?.label ?: "No"}",
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
                Text(
                    "${question.options.lastOrNull()?.label ?: "Yes"} →",
                    style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                )
            }
        }

        // Option buttons (always shown — canonical input)
        question.options.forEach { option ->
            OutlinedButton(
                onClick  = { onAnswer(question.id, option.id) },
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(12.dp),
                colors   = ButtonDefaults.outlinedButtonColors(contentColor = colors.ink),
                border   = androidx.compose.foundation.BorderStroke(1.dp, colors.rule),
            ) {
                Text(option.label, style = MaterialTheme.typography.bodyMedium.copy(color = colors.ink))
            }
        }
    }
}

@Composable
private fun ResultView(
    phase:       SwipePhase.Result,
    onItemClick: (WatchlistItem) -> Unit,
    onTryAgain:  () -> Unit,
    onDone:      () -> Unit,
) {
    val colors = CinemoodTheme.colors
    val winner = phase.response.winner
    val t      = winner.title

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = 24.dp, bottom = 120.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text  = "TONIGHT'S PICK",
            style = MaterialTheme.typography.labelSmall.copy(
                color         = colors.accent,
                letterSpacing = 1.5.sp,
            ),
        )

        if (t.posterPath != null) {
            AsyncImage(
                model              = "$TMDB_POSTER${t.posterPath}",
                contentDescription = t.title,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier
                    .width(160.dp)
                    .height(240.dp)
                    .clip(RoundedCornerShape(16.dp)),
            )
        }

        Text(
            text  = t.title,
            style = MaterialTheme.typography.headlineMedium.copy(color = colors.ink),
        )

        val meta = listOfNotNull(
            t.releaseDate?.take(4),
            t.runtime?.let { "${it}m" },
            if (t.type == "series") "Series" else "Film",
        ).joinToString(" · ")
        if (meta.isNotEmpty()) {
            Text(meta, style = MaterialTheme.typography.bodySmall.copy(color = colors.faint))
        }

        if (phase.response.reason.isNotBlank()) {
            Text(
                text  = phase.response.reason,
                style = MaterialTheme.typography.bodyMedium.copy(color = colors.dim),
            )
        }

        Button(
            onClick  = { onItemClick(winner) },
            modifier = Modifier.fillMaxWidth(),
            shape    = RoundedCornerShape(12.dp),
            colors   = ButtonDefaults.buttonColors(containerColor = colors.accent),
        ) { Text("View details") }

        // Runners-up
        if (phase.response.runnersUp.isNotEmpty()) {
            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)
            Text(
                "Also great",
                style    = MaterialTheme.typography.labelSmall.copy(color = colors.faint, letterSpacing = 1.sp),
                modifier = Modifier.fillMaxWidth(),
            )
            phase.response.runnersUp.forEach { runnerUp ->
                val rt = runnerUp.item.title
                Row(
                    modifier              = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(colors.paper2),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment     = Alignment.CenterVertically,
                ) {
                    if (rt.posterPath != null) {
                        AsyncImage(
                            model        = "$TMDB_POSTER${rt.posterPath}",
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier     = Modifier
                                .size(width = 44.dp, height = 66.dp)
                                .clip(RoundedCornerShape(8.dp, 0.dp, 0.dp, 8.dp)),
                        )
                    }
                    Column(
                        modifier            = Modifier.weight(1f).padding(vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(rt.title, style = MaterialTheme.typography.bodyMedium.copy(color = colors.ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(runnerUp.reason, style = MaterialTheme.typography.bodySmall.copy(color = colors.dim), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                }
            }
        }

        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedButton(
                onClick  = onTryAgain,
                modifier = Modifier.weight(1f),
                shape    = RoundedCornerShape(12.dp),
                colors   = ButtonDefaults.outlinedButtonColors(contentColor = colors.faint),
                border   = androidx.compose.foundation.BorderStroke(1.dp, colors.rule),
            ) { Text("Try again") }
            TextButton(onClick = onDone, modifier = Modifier.weight(1f)) {
                Text("Done", color = colors.dim)
            }
        }
    }
}
