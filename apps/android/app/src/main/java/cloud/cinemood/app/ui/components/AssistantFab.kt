package cloud.cinemood.app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import cloud.cinemood.app.ui.theme.CinemoodTheme
import cloud.cinemood.app.ui.util.rememberReducedMotion

@Composable
fun AssistantFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors        = CinemoodTheme.colors
    val reduced       = rememberReducedMotion()
    val interaction   = remember { MutableInteractionSource() }
    val isPressed     by interaction.collectIsPressedAsState()
    val scale         by animateFloatAsState(
        targetValue   = if (isPressed && !reduced) 0.92f else 1f,
        animationSpec = tween(150),
        label         = "fabScale",
    )

    FloatingActionButton(
        onClick              = onClick,
        modifier             = modifier.scale(scale),
        shape                = CircleShape,
        containerColor       = colors.accent,
        contentColor         = Color.White,
        elevation            = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp),
        interactionSource    = interaction,
    ) {
        AiSearchIcon(size = 24.dp)
    }
}
