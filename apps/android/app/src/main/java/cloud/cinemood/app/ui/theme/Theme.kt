package cloud.cinemood.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── Palette ──────────────────────────────────────────────────────────────────
// Mirrors the web CSS custom properties for visual consistency.

val CineMoodPaper   = Color(0xFFF5F0E8)  // --paper
val CineMoodPaper2  = Color(0xFFEDE8DE)  // --paper-2
val CineMoodInk     = Color(0xFF1A1613)  // --ink
val CineMoodAccent  = Color(0xFFB91C1C)  // --accent (crimson)
val CineMoodDim     = Color(0xFF6B6560)  // --paper-dim
val CineMoodFaint   = Color(0xFFABA49A)  // --paper-faint
val CineMoodRule    = Color(0xFFE5E0D5)  // --rule

private val LightColorScheme = lightColorScheme(
    primary              = CineMoodAccent,
    onPrimary            = CineMoodPaper,
    primaryContainer     = Color(0xFFFEE2E2),
    onPrimaryContainer   = Color(0xFF7F1D1D),
    secondary            = CineMoodDim,
    onSecondary          = CineMoodPaper,
    background           = CineMoodPaper,
    onBackground         = CineMoodInk,
    surface              = CineMoodPaper,
    onSurface            = CineMoodInk,
    surfaceVariant       = CineMoodPaper2,
    onSurfaceVariant     = CineMoodDim,
    outline              = CineMoodRule,
)

@Composable
fun CinemoodTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography  = CinemoodTypography,
        content     = content,
    )
}
