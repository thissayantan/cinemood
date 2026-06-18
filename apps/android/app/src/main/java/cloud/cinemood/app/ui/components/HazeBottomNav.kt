package cloud.cinemood.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials
import cloud.cinemood.app.navigation.Screen
import cloud.cinemood.app.ui.theme.CinemoodTheme

data class NavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String,
)

private val NAV_ITEMS = listOf(
    NavItem(Screen.Home,      Icons.Rounded.AutoAwesome,    "For You"),
    NavItem(Screen.Watchlist, Icons.Rounded.LocalMovies,    "Library"),
    NavItem(Screen.Decide,    Icons.Rounded.Shuffle,        "Decide"),
    NavItem(Screen.Settings,  Icons.Rounded.AccountCircle,  "Profile"),
)

@OptIn(ExperimentalHazeMaterialsApi::class)
@Composable
fun HazeBottomNav(
    currentRoute: String?,
    hazeState: HazeState,
    onNavigate: (Screen) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors    = CinemoodTheme.colors
    val pillShape = RoundedCornerShape(36.dp)

    val glassStyle = HazeMaterials.thin(
        containerColor = colors.paper.copy(alpha = 0.80f),
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 20.dp)
            .navigationBarsPadding(),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Row(
            modifier = Modifier
                .shadow(
                    elevation    = 16.dp,
                    shape        = pillShape,
                    ambientColor = colors.accent.copy(alpha = 0.08f),
                    spotColor    = colors.paper.copy(alpha = 0.12f),
                )
                .clip(pillShape)
                .hazeEffect(state = hazeState, style = glassStyle)
                .background(colors.paper.copy(alpha = 0.04f))
                .padding(horizontal = 8.dp, vertical = 10.dp)
                .selectableGroup(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment     = Alignment.CenterVertically,
        ) {
            NAV_ITEMS.forEach { item ->
                val selected = currentRoute == item.screen.route

                val iconColor by animateColorAsState(
                    targetValue   = if (selected) colors.accent else colors.faint,
                    animationSpec = spring(stiffness = 400f),
                    label         = "navIconColor_${item.label}",
                )
                val labelColor by animateColorAsState(
                    targetValue   = if (selected) colors.accent else colors.faint,
                    animationSpec = spring(stiffness = 400f),
                    label         = "navLabelColor_${item.label}",
                )

                Column(
                    modifier            = Modifier
                        .weight(1f)
                        .selectable(
                            selected  = selected,
                            onClick   = { onNavigate(item.screen) },
                            role      = Role.Tab,
                        )
                        .padding(vertical = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    // Selection pill behind icon
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                if (selected) colors.accent.copy(alpha = 0.15f)
                                else          androidx.compose.ui.graphics.Color.Transparent
                            )
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                    ) {
                        Icon(
                            imageVector        = item.icon,
                            contentDescription = item.label,
                            tint               = iconColor,
                            modifier           = Modifier.size(24.dp),
                        )
                    }

                    Text(
                        text  = item.label,
                        style = MaterialTheme.typography.labelSmall.copy(
                            color         = labelColor,
                            fontSize      = androidx.compose.ui.unit.TextUnit(9f, androidx.compose.ui.unit.TextUnitType.Sp),
                            letterSpacing = 0.3.sp,
                        ),
                    )
                }
            }
        }
    }
}
