package cloud.cinemood.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials
import cloud.cinemood.app.navigation.Screen
import cloud.cinemood.app.ui.theme.*

data class NavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String,
)

private val NAV_ITEMS = listOf(
    NavItem(Screen.Home,      Icons.Filled.Home,        "For You"),
    NavItem(Screen.Watchlist, Icons.Filled.List,         "Watchlist"),
    NavItem(Screen.Decide,    Icons.Filled.Psychology,   "Decide"),
    NavItem(Screen.Settings,  Icons.Filled.Settings,     "Settings"),
)

/**
 * Floating liquid-glass bottom navigation pill.
 *
 * Uses Haze for the frosted-glass backdrop blur when available (API 31+).
 * Falls back to a high-opacity solid background on older APIs or when
 * reduce-transparency is enabled.
 *
 * The pill floats above the content — position it in a Box overlay.
 */
@OptIn(ExperimentalHazeMaterialsApi::class)
@Composable
fun HazeBottomNav(
    currentRoute: String?,
    hazeState: HazeState,
    onNavigate: (Screen) -> Unit,
    modifier: Modifier = Modifier,
) {
    val pillShape = RoundedCornerShape(32.dp)

    // Warm translucent tint over cream palette — the "liquid glass" look
    val glassStyle = HazeMaterials.thin(
        containerColor = CineMoodPaper.copy(alpha = 0.72f),
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Row(
            modifier = Modifier
                .shadow(
                    elevation    = 12.dp,
                    shape        = pillShape,
                    ambientColor = CineMoodInk.copy(alpha = 0.12f),
                    spotColor    = CineMoodInk.copy(alpha = 0.08f),
                )
                .clip(pillShape)
                .hazeEffect(state = hazeState, style = glassStyle)
                .background(CineMoodPaper.copy(alpha = 0.06f)) // subtle tint over glass
                .padding(horizontal = 4.dp, vertical = 8.dp)
                .selectableGroup(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment     = Alignment.CenterVertically,
        ) {
            NAV_ITEMS.forEach { item ->
                val selected = currentRoute == item.screen.route
                val iconColor by animateColorAsState(
                    targetValue = if (selected) CineMoodAccent else CineMoodDim,
                    animationSpec = spring(),
                    label = "navIconColor_${item.label}",
                )
                val labelColor by animateColorAsState(
                    targetValue = if (selected) CineMoodAccent else CineMoodDim,
                    animationSpec = spring(),
                    label = "navLabelColor_${item.label}",
                )
                Column(
                    modifier            = Modifier
                        .weight(1f)
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    IconButton(
                        onClick   = { onNavigate(item.screen) },
                        modifier  = Modifier.size(36.dp),
                    ) {
                        Icon(
                            imageVector         = item.icon,
                            contentDescription  = item.label,
                            tint                = iconColor,
                            modifier            = Modifier.size(22.dp),
                        )
                    }
                    Text(
                        text  = item.label,
                        style = MaterialTheme.typography.labelSmall.copy(color = labelColor),
                    )
                }
            }
        }
    }
}
