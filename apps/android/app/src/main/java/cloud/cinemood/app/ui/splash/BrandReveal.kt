package cloud.cinemood.app.ui.splash

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// Cinema-room palette — matches Theme.kt / wrangler dark values
private val DarkPlate = Color(0xFF0A0908)
private val Cream     = Color(0xFFF2EBDD)
private val Crimson   = Color(0xFFC8302A)

/**
 * Full-screen brand reveal overlay.
 *
 * Displayed over the real UI immediately after the OS cold-start splash
 * hands off. Because the underlying composable tree renders in parallel,
 * the 600ms draw-on animation is free cover time — it never gates content.
 *
 * Motion: "Cinemood" in display serif settles, then the crimson Criterion
 * spine-number underline draws left→right (~600ms, ease-out), holds for a
 * beat, then the whole overlay fades to transparent (~200ms) before calling
 * [onFinished].
 *
 * Reduced motion: if [Settings.Global.ANIMATOR_DURATION_SCALE] is 0, the
 * reveal is skipped entirely and [onFinished] is called immediately.
 */
@Composable
fun BrandReveal(onFinished: () -> Unit) {
    val context = LocalContext.current

    // Respect the global reduced-motion setting
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

    // Underline draw-on: 0f (zero width) → 1f (full width)
    val underlineProgress = remember { Animatable(0f) }
    // Overlay fade-out: 1f (opaque) → 0f (transparent)
    val overlayAlpha = remember { Animatable(1f) }

    LaunchedEffect(Unit) {
        // Brief pause so the OS splash exits and the Compose frame settles
        delay(80L)
        // Draw the crimson underline left→right (ease-out, 600ms)
        underlineProgress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 600, easing = FastOutSlowInEasing),
        )
        // Hold so the full mark is readable for a moment
        delay(200L)
        // Fade the overlay out (200ms linear)
        overlayAlpha.animateTo(
            targetValue = 0f,
            animationSpec = tween(durationMillis = 200, easing = LinearEasing),
        )
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(overlayAlpha.value)
            .background(DarkPlate),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            // width(IntrinsicSize.Max) → Column is as wide as the widest child
            // (the Text). The underline Box uses fillMaxWidth() to match exactly.
            modifier = Modifier.width(androidx.compose.ui.unit.Dp.Unspecified),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Wordmark — system serif at display weight mirrors web Fraunces spirit
            Text(
                text = "Cinemood",
                color = Cream,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 42.sp,
                letterSpacing = (-0.5).sp,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Criterion spine-number underline — drawn left→right by clipToBounds
            // on the inner box whose width expands with underlineProgress
            Box(
                modifier = Modifier
                    .width(168.dp)   // visually matches 42sp serif wordmark width
                    .height(2.dp),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(fraction = underlineProgress.value)
                        .background(Crimson),
                )
            }
        }
    }
}
