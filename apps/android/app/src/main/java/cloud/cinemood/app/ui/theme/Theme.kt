package cloud.cinemood.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// ── Palette tokens ────────────────────────────────────────────────────────────
// All hex values mirror the web CSS custom properties in apps/web/src/globals.css.

/** Immutable semantic color holder. Provided via [LocalCinemoodColors]. */
data class CinemoodColors(
    val paper:  Color,  // page background
    val paper2: Color,  // card / surface background
    val ink:    Color,  // body text
    val accent: Color,  // crimson primary action
    val dim:    Color,  // secondary text
    val faint:  Color,  // placeholder / disabled text
    val rule:   Color,  // divider / outline
)

// Light — "matinée": warm cream paper, charcoal ink
val LightCinemoodColors = CinemoodColors(
    paper  = Color(0xFFF5F0E8),
    paper2 = Color(0xFFEDE8DE),
    ink    = Color(0xFF1A1613),
    accent = Color(0xFFB91C1C),
    dim    = Color(0xFF6B6560),
    faint  = Color(0xFFABA49A),
    rule   = Color(0xFFE5E0D5),
)

// Dark — "cinema-room": near-black plate, cream type, brighter crimson
val DarkCinemoodColors = CinemoodColors(
    paper  = Color(0xFF0A0908),
    paper2 = Color(0xFF13110E),
    ink    = Color(0xFFF2EBDD),
    accent = Color(0xFFC8302A),
    dim    = Color(0xB3F2EBDD),  // cream @70%
    faint  = Color(0x61F2EBDD),  // cream @38%
    rule   = Color(0x24F2EBDD),  // cream @14%
)

// Dark plate used inside the Surface/cards slot
private val DarkPaper3 = Color(0xFF1A1814)

/** Access the current palette via [CinemoodTheme.colors] inside any composable. */
val LocalCinemoodColors = staticCompositionLocalOf { LightCinemoodColors }

// ── Material color schemes ────────────────────────────────────────────────────

private val LightColorScheme = lightColorScheme(
    primary              = LightCinemoodColors.accent,
    onPrimary            = LightCinemoodColors.paper,
    primaryContainer     = Color(0xFFFEE2E2),
    onPrimaryContainer   = Color(0xFF7F1D1D),
    secondary            = LightCinemoodColors.dim,
    onSecondary          = LightCinemoodColors.paper,
    background           = LightCinemoodColors.paper,
    onBackground         = LightCinemoodColors.ink,
    surface              = LightCinemoodColors.paper,
    onSurface            = LightCinemoodColors.ink,
    surfaceVariant       = LightCinemoodColors.paper2,
    onSurfaceVariant     = LightCinemoodColors.dim,
    outline              = LightCinemoodColors.rule,
)

private val DarkColorScheme = darkColorScheme(
    primary              = DarkCinemoodColors.accent,
    onPrimary            = Color.White,
    primaryContainer     = Color(0xFF7F1D1D),
    onPrimaryContainer   = Color(0xFFFEE2E2),
    secondary            = DarkCinemoodColors.dim,
    onSecondary          = DarkCinemoodColors.paper,
    background           = DarkCinemoodColors.paper,
    onBackground         = DarkCinemoodColors.ink,
    surface              = DarkCinemoodColors.paper2,
    onSurface            = DarkCinemoodColors.ink,
    surfaceVariant       = DarkPaper3,
    onSurfaceVariant     = DarkCinemoodColors.dim,
    outline              = DarkCinemoodColors.rule,
)

// ── Theme composable ──────────────────────────────────────────────────────────

@Composable
fun CinemoodTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkCinemoodColors else LightCinemoodColors
    val scheme = if (darkTheme) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(LocalCinemoodColors provides colors) {
        MaterialTheme(
            colorScheme = scheme,
            typography  = CinemoodTypography,
            content     = content,
        )
    }
}

// ── Accessor (mirrors MaterialTheme's style so call sites feel native) ────────

/** Read the current palette: `CinemoodTheme.colors.ink`, `.accent`, etc. */
object CinemoodTheme {
    val colors: CinemoodColors
        @Composable get() = LocalCinemoodColors.current
}
