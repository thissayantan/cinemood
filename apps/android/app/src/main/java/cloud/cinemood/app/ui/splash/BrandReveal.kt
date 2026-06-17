package cloud.cinemood.app.ui.splash

import android.media.AudioManager
import android.media.SoundPool
import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cloud.cinemood.app.R
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

// ── Palette ──────────────────────────────────────────────────────────────────

private val DarkPlate   = Color(0xFF0E0D0B)
private val CardCrimson = Color(0xFFEA5043)
private val CardAmber   = Color(0xFFE09A33)
private val CardTeal    = Color(0xFF1F8C7C)
private val CardInk     = Color(0xFF1A1410)
private val CardCream   = Color(0xFFFBF4E9)
private val WordmarkCream = Color(0xFFF5F0E8)

/**
 * Full-screen brand reveal — "lights, camera, action."
 *
 * Staged sequence (~1 000ms total, non-blocking):
 *   1.  0– 160ms  Crimson card scales + fades in.
 *   2. 140– 340ms  Amber card fans out from behind (rotation: –5° → +4°).
 *   3. 240– 420ms  Teal card fans further out (–5° → +11°).
 *   4. 360– 520ms  Clapperboard body fades + scales onto the front card.
 *   5. 520– 660ms  Clapper arm snaps shut (spring) — clack sound fires at contact.
 *   6. 640– 820ms  "Cinemood" in Handlee fades up.
 *   7. 820–1 000ms  Hold, then overlay fades to transparent → onFinished().
 *
 * Tap anywhere to skip immediately.
 * Reduced motion (ANIMATOR_DURATION_SCALE == 0) → onFinished() is called instantly.
 * Silent / DND → animation plays, clack is suppressed.
 */
@Composable
fun BrandReveal(onFinished: () -> Unit) {
    val context = LocalContext.current

    // ── Reduced-motion guard ──────────────────────────────────────────────
    val reducedMotion = remember {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
    }
    if (reducedMotion) {
        LaunchedEffect(Unit) { onFinished() }
        return
    }

    // ── Animatables ───────────────────────────────────────────────────────
    // Crimson card entry
    val crimsonAlpha = remember { Animatable(0f) }
    val crimsonScale = remember { Animatable(0.86f) }

    // Amber / teal fan (angle in degrees, starting stacked at front card position)
    val amberAlpha = remember { Animatable(0f) }
    val amberAngle = remember { Animatable(-5f) }   // fans to +4°
    val tealAlpha  = remember { Animatable(0f) }
    val tealAngle  = remember { Animatable(-5f) }   // fans to +11°

    // Clapperboard reveal
    val boardAlpha = remember { Animatable(0f) }
    val boardScale = remember { Animatable(0.90f) }

    // Clapper arm snap: –26° (open) → 0° (shut), with spring overshoot
    val clapArmAngle = remember { Animatable(-26f) }

    // Wordmark entry
    val wordmarkAlpha  = remember { Animatable(0f) }
    val wordmarkOffY   = remember { Animatable(10f) }

    // Overlay fade-out
    val overlayAlpha = remember { Animatable(1f) }

    // ── Sound ─────────────────────────────────────────────────────────────
    val audioManager = remember {
        context.getSystemService(AudioManager::class.java)
    }
    val soundPool = remember { SoundPool.Builder().setMaxStreams(1).build() }
    val soundId = remember {
        try { soundPool.load(context, R.raw.clapper_clack, 1) } catch (_: Exception) { -1 }
    }
    DisposableEffect(Unit) { onDispose { soundPool.release() } }

    // ── Skip on tap ───────────────────────────────────────────────────────
    val scope = rememberCoroutineScope()
    var animJob by remember { mutableStateOf<Job?>(null) }

    // ── Animation sequence ────────────────────────────────────────────────
    LaunchedEffect(Unit) {
        animJob = launch {
            val fast = FastOutSlowInEasing

            // 1. Crimson card scales + fades in (0–160ms)
            launch { crimsonAlpha.animateTo(1f, tween(160, easing = fast)) }
            launch { crimsonScale.animateTo(1f, tween(160, easing = fast)) }

            kotlinx.coroutines.delay(140)

            // 2. Amber fans out from behind (140–340ms)
            launch { amberAlpha.animateTo(1f, tween(30, easing = fast)) }
            launch { amberAngle.animateTo(4f, tween(200, easing = fast)) }

            kotlinx.coroutines.delay(100)

            // 3. Teal fans out further (240–420ms)
            launch { tealAlpha.animateTo(1f, tween(30, easing = fast)) }
            launch { tealAngle.animateTo(11f, tween(200, easing = fast)) }

            kotlinx.coroutines.delay(120)

            // 4. Clapperboard body reveals (360–520ms)
            launch { boardAlpha.animateTo(1f, tween(160, easing = fast)) }
            launch { boardScale.animateTo(1f, tween(160, easing = fast)) }

            kotlinx.coroutines.delay(160)

            // 5. Clapper arm snaps shut with spring bounce (520–660ms)
            launch {
                clapArmAngle.animateTo(
                    targetValue = 0f,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness    = Spring.StiffnessHigh,
                    ),
                )
            }

            kotlinx.coroutines.delay(120)

            // 6. Clack fires + wordmark fades up (640–820ms)
            if (soundId > 0 &&
                audioManager?.ringerMode == AudioManager.RINGER_MODE_NORMAL
            ) {
                soundPool.play(soundId, 0.75f, 0.75f, 0, 0, 1.0f)
            }
            launch { wordmarkAlpha.animateTo(1f, tween(180, easing = fast)) }
            launch { wordmarkOffY.animateTo(0f, tween(180, easing = fast)) }

            // 7. Hold (820–980ms)
            kotlinx.coroutines.delay(340)

            // 8. Overlay fades out (980–1 140ms)
            overlayAlpha.animateTo(0f, tween(160, easing = LinearEasing))
            onFinished()
        }
    }

    // ── Handlee wordmark font ─────────────────────────────────────────────
    val handlee = remember { FontFamily(Font(R.font.handlee, FontWeight.Normal)) }

    // ── UI ───────────────────────────────────────────────────────────────
    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(overlayAlpha.value)
            .background(DarkPlate)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) {
                scope.launch {
                    animJob?.cancel()
                    onFinished()
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {

            // ── Icon canvas ───────────────────────────────────────────────
            //
            // Design space: 280×280. The canvas is 200dp; scale factor
            // ds = canvasPixels / 280 maps every design coordinate naturally.
            // Design center ≈ (140,140) → maps to canvas center. ✓
            Canvas(modifier = Modifier.size(200.dp)) {
                val ds = size.width / 280f   // design-to-canvas scale

                withTransform({ scale(ds, ds, Offset.Zero) }) {

                    // — Teal card (back) ——————————————————————————————
                    withTransform({ rotate(tealAngle.value, Offset(150f, 230f)) }) {
                        drawRoundRect(
                            color        = CardTeal.copy(alpha = tealAlpha.value),
                            topLeft      = Offset(92f, 70f),
                            size         = Size(118f, 158f),
                            cornerRadius = CornerRadius(28f),
                        )
                    }

                    // — Amber card (mid) ———————————————————————————————
                    withTransform({ rotate(amberAngle.value, Offset(150f, 230f)) }) {
                        drawRoundRect(
                            color        = CardAmber.copy(alpha = amberAlpha.value),
                            topLeft      = Offset(84f, 64f),
                            size         = Size(118f, 158f),
                            cornerRadius = CornerRadius(28f),
                        )
                    }

                    // — Crimson card (front) with clapperboard ————————
                    withTransform({ rotate(-5f, Offset(150f, 230f)) }) {

                        // Card entry scale (around card center 135,137)
                        withTransform({
                            scale(
                                scaleX = crimsonScale.value,
                                scaleY = crimsonScale.value,
                                pivot  = Offset(135f, 137f),
                            )
                        }) {
                            drawRoundRect(
                                color        = CardCrimson.copy(alpha = crimsonAlpha.value),
                                topLeft      = Offset(76f, 58f),
                                size         = Size(118f, 158f),
                                cornerRadius = CornerRadius(28f),
                            )
                        }

                        // Clapperboard — scales from clapperboard center (135, 112)
                        val bA = boardAlpha.value
                        withTransform({
                            scale(
                                scaleX = boardScale.value,
                                scaleY = boardScale.value,
                                pivot  = Offset(135f, 112f),
                            )
                        }) {
                            // Body (ink)
                            drawRoundRect(
                                color        = CardInk.copy(alpha = bA),
                                topLeft      = Offset(95f, 104f),
                                size         = Size(80f, 52f),
                                cornerRadius = CornerRadius(8f),
                            )

                            // Arm (ink) — rotates from open (–26°) to shut (0°)
                            // around the left-bottom hinge point (95, 103)
                            withTransform({ rotate(clapArmAngle.value, Offset(95f, 103f)) }) {
                                drawRoundRect(
                                    color        = CardInk.copy(alpha = bA),
                                    topLeft      = Offset(95f, 83f),
                                    size         = Size(80f, 20f),
                                    cornerRadius = CornerRadius(4f),
                                )
                                // Diagonal stripes — clipped to the arm rect
                                clipRect(
                                    left   = 95f,
                                    top    = 83f,
                                    right  = 175f,
                                    bottom = 103f,
                                ) {
                                    val stripePath = Path().apply {
                                        // 5 parallelograms; top 13px wide, shift 8px diagonally
                                        for (i in 0..4) {
                                            val x = 101f + i * 17f
                                            moveTo(x + 8f,  83f)
                                            lineTo(x + 21f, 83f)
                                            lineTo(x + 13f, 103f)
                                            lineTo(x,       103f)
                                            close()
                                        }
                                    }
                                    drawPath(stripePath, CardCream.copy(alpha = bA))
                                }
                            }

                            // Body text lines (cream)
                            drawRoundRect(
                                color        = CardCream.copy(alpha = bA * 0.85f),
                                topLeft      = Offset(107f, 119f),
                                size         = Size(54f, 6f),
                                cornerRadius = CornerRadius(3f),
                            )
                            drawRoundRect(
                                color        = CardCream.copy(alpha = bA * 0.85f),
                                topLeft      = Offset(107f, 133f),
                                size         = Size(38f, 6f),
                                cornerRadius = CornerRadius(3f),
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // ── Wordmark ──────────────────────────────────────────────────
            Text(
                text       = "Cinemood",
                modifier   = Modifier
                    .alpha(wordmarkAlpha.value)
                    .offset(y = wordmarkOffY.value.dp),
                color      = WordmarkCream,
                fontFamily = handlee,
                fontWeight = FontWeight.Normal,
                fontSize   = 40.sp,
            )
        }
    }
}
