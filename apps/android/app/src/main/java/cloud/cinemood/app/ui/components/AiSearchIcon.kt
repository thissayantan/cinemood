package cloud.cinemood.app.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import cloud.cinemood.app.ui.theme.CinemoodTheme

/**
 * AI-indicated search glyph: a magnifier with a small sparkle badge overlaid
 * at the top-right corner. Signals "this search is powered by AI", not a
 * plain TMDB keyword search.
 *
 * Usage:
 *   AiSearchIcon()                    // default 24dp
 *   AiSearchIcon(size = 20.dp)        // scaled
 */
@Composable
fun AiSearchIcon(
    modifier: Modifier = Modifier,
    size: Dp = 24.dp,
) {
    val colors = CinemoodTheme.colors
    Box(
        modifier = modifier.size(size),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector        = Icons.Rounded.Search,
            contentDescription = null,
            modifier           = Modifier.size(size),
            tint               = colors.accent,
        )
        // Sparkle badge — positioned at the top-right of the magnifier
        Icon(
            imageVector        = Icons.Rounded.AutoAwesome,
            contentDescription = null,
            modifier           = Modifier
                .size(size * 0.42f)
                .align(Alignment.TopEnd)
                .offset(x = (size * 0.10f), y = -(size * 0.08f)),
            tint               = colors.accent,
        )
    }
}
