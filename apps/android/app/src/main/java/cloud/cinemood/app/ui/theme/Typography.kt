package cloud.cinemood.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import cloud.cinemood.app.R

// Lato for body/UI; system serif for display headlines (matches web Fraunces spirit)
// Lato bundled in res/font/; fallback = sans-serif for builds without font resources
private val LatoFamily = try {
    FontFamily(
        Font(R.font.lato_regular, FontWeight.Normal),
        Font(R.font.lato_bold, FontWeight.Bold),
    )
} catch (_: Exception) {
    FontFamily.SansSerif
}

val CinemoodTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily  = FontFamily.Serif,
        fontWeight  = FontWeight.Bold,
        fontSize    = 32.sp,
        lineHeight  = 40.sp,
        letterSpacing = (-0.5).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily  = FontFamily.Serif,
        fontWeight  = FontWeight.Bold,
        fontSize    = 24.sp,
        lineHeight  = 32.sp,
    ),
    titleLarge = TextStyle(
        fontFamily  = LatoFamily,
        fontWeight  = FontWeight.Bold,
        fontSize    = 18.sp,
        lineHeight  = 24.sp,
    ),
    titleMedium = TextStyle(
        fontFamily  = LatoFamily,
        fontWeight  = FontWeight.Bold,
        fontSize    = 14.sp,
        lineHeight  = 20.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily  = LatoFamily,
        fontWeight  = FontWeight.Normal,
        fontSize    = 16.sp,
        lineHeight  = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily  = LatoFamily,
        fontWeight  = FontWeight.Normal,
        fontSize    = 14.sp,
        lineHeight  = 20.sp,
    ),
    bodySmall = TextStyle(
        fontFamily  = LatoFamily,
        fontWeight  = FontWeight.Normal,
        fontSize    = 12.sp,
        lineHeight  = 16.sp,
    ),
    labelSmall = TextStyle(
        fontFamily  = LatoFamily,
        fontWeight  = FontWeight.Bold,
        fontSize    = 10.sp,
        lineHeight  = 14.sp,
        letterSpacing = 0.8.sp,
    ),
)
