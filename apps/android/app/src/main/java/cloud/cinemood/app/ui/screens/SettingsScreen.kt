package cloud.cinemood.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cloud.cinemood.app.BuildConfig
import cloud.cinemood.app.data.model.UserProfile
import cloud.cinemood.app.data.settings.SettingsStore
import cloud.cinemood.app.ui.theme.CinemoodTheme
import coil3.compose.AsyncImage

// Common regions for the picker
private val REGIONS = listOf(
    "IN" to "India",
    "US" to "United States",
    "GB" to "United Kingdom",
    "CA" to "Canada",
    "AU" to "Australia",
    "DE" to "Germany",
    "FR" to "France",
    "JP" to "Japan",
    "BR" to "Brazil",
    "MX" to "Mexico",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    profile: UserProfile?,
    watchlistCounts: Map<String, Int>,
    settingsStore: SettingsStore,
    onSignOut: () -> Unit,
    onNavigateToLibrary: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors  = CinemoodTheme.colors
    val context = LocalContext.current

    var showRegionSheet    by remember { mutableStateOf(false) }
    var showAppearanceSheet by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.paper)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // ── Page title ─────────────────────────────────────────────────────────
        Text(
            text  = "Profile",
            style = MaterialTheme.typography.headlineMedium.copy(color = colors.ink),
        )

        // ── Account card ───────────────────────────────────────────────────────
        SettingsCard {
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                modifier              = Modifier.fillMaxWidth().padding(16.dp),
            ) {
                Box(
                    modifier         = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(colors.paper2),
                    contentAlignment = Alignment.Center,
                ) {
                    if (!profile?.picture.isNullOrBlank()) {
                        AsyncImage(
                            model              = profile?.picture,
                            contentDescription = "Profile picture",
                            contentScale       = ContentScale.Crop,
                            modifier           = Modifier.fillMaxSize(),
                            onError            = {},
                        )
                    } else {
                        Text(
                            text  = (profile?.name ?: profile?.email ?: "?").take(1).uppercase(),
                            style = MaterialTheme.typography.titleLarge.copy(color = colors.accent),
                        )
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text  = profile?.name ?: "Cinemood",
                        style = MaterialTheme.typography.titleMedium.copy(color = colors.ink),
                    )
                    if (!profile?.email.isNullOrBlank()) {
                        Text(
                            text  = profile?.email ?: "",
                            style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                        )
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector        = Icons.Rounded.CheckCircle,
                            contentDescription = null,
                            tint               = Color(0xFF34A853),
                            modifier           = Modifier.size(12.dp),
                        )
                        Text(
                            text  = "Google Account",
                            style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                        )
                    }
                }
            }
        }

        // ── Library snapshot ───────────────────────────────────────────────────
        SettingsSectionLabel("Your library")
        SettingsCard {
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                listOf(
                    "pending"  to "To watch",
                    "watching" to "Watching",
                    "watched"  to "Watched",
                ).forEach { (status, label) ->
                    val n = watchlistCounts[status] ?: 0
                    Column(
                        modifier            = Modifier
                            .weight(1f)
                            .clickable { onNavigateToLibrary(status) }
                            .padding(vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            text  = "$n",
                            style = MaterialTheme.typography.headlineMedium.copy(
                                color      = colors.ink,
                                fontWeight = FontWeight.Bold,
                            ),
                        )
                        Text(
                            text  = label,
                            style = MaterialTheme.typography.labelSmall.copy(color = colors.faint),
                        )
                    }
                    if (status != "watched") {
                        Box(
                            modifier = Modifier
                                .width(0.5.dp)
                                .height(48.dp)
                                .background(colors.rule)
                                .align(Alignment.CenterVertically),
                        )
                    }
                }
            }
        }

        // ── Preferences ────────────────────────────────────────────────────────
        SettingsSectionLabel("Preferences")
        SettingsCard {
            // Streaming region
            val regionLabel = REGIONS.find { it.first == settingsStore.region }?.second
                ?: settingsStore.region
            SettingsRow(
                icon    = Icons.Rounded.Language,
                title   = "Streaming region",
                value   = regionLabel,
                tint    = colors.faint,
                onClick = { showRegionSheet = true },
            )
            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)
            // Appearance
            val appearanceLabel = when (settingsStore.themeMode) {
                SettingsStore.THEME_LIGHT  -> "Light"
                SettingsStore.THEME_DARK   -> "Dark"
                else                       -> "System"
            }
            SettingsRow(
                icon    = Icons.Rounded.DarkMode,
                title   = "Appearance",
                value   = appearanceLabel,
                tint    = colors.faint,
                onClick = { showAppearanceSheet = true },
            )
        }

        // ── About ──────────────────────────────────────────────────────────────
        SettingsSectionLabel("About")
        SettingsCard {
            SettingsRow(
                icon    = Icons.Rounded.Info,
                title   = "Version",
                value   = BuildConfig.VERSION_NAME,
                tint    = colors.faint,
                onClick = null,
            )
            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)
            SettingsRow(
                icon    = Icons.Rounded.StarRate,
                title   = "Rate Cinemood",
                value   = "",
                tint    = Color(0xFFE8A03A),
                onClick = {
                    val intent = Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("market://details?id=${context.packageName}"),
                    )
                    runCatching { context.startActivity(intent) }
                },
            )
            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)
            SettingsRow(
                icon    = Icons.Rounded.Email,
                title   = "Send feedback",
                value   = "",
                tint    = colors.faint,
                onClick = {
                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data    = Uri.parse("mailto:")
                        putExtra(Intent.EXTRA_EMAIL, arrayOf("feedback@cinemood.sayantan.cloud"))
                        putExtra(Intent.EXTRA_SUBJECT, "Cinemood Android feedback")
                    }
                    runCatching { context.startActivity(intent) }
                },
            )
        }

        Spacer(modifier = Modifier.weight(1f, fill = false))

        // ── Sign out ───────────────────────────────────────────────────────────
        OutlinedButton(
            onClick  = onSignOut,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape    = RoundedCornerShape(14.dp),
            colors   = ButtonDefaults.outlinedButtonColors(contentColor = colors.accent),
            border   = androidx.compose.foundation.BorderStroke(1.dp, colors.accent.copy(alpha = 0.4f)),
        ) {
            Icon(Icons.Rounded.Logout, null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text  = "Sign out",
                style = MaterialTheme.typography.titleMedium.copy(
                    color      = colors.accent,
                    fontWeight = FontWeight.SemiBold,
                ),
            )
        }
    }

    // ── Region bottom sheet ────────────────────────────────────────────────────
    if (showRegionSheet) {
        ModalBottomSheet(
            onDismissRequest     = { showRegionSheet = false },
            containerColor       = colors.paper,
            contentColor         = colors.ink,
        ) {
            Column(modifier = Modifier.padding(bottom = 32.dp)) {
                Text(
                    text     = "Streaming region",
                    style    = MaterialTheme.typography.titleMedium.copy(color = colors.ink),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                )
                REGIONS.forEach { (code, name) ->
                    val selected = settingsStore.region == code
                    Row(
                        modifier              = Modifier
                            .fillMaxWidth()
                            .clickable {
                                settingsStore.setRegion(code)
                                showRegionSheet = false
                            }
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text  = name,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = if (selected) colors.accent else colors.ink,
                            ),
                        )
                        if (selected) {
                            Icon(
                                Icons.Rounded.Check,
                                null,
                                tint     = colors.accent,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                    if (code != REGIONS.last().first) {
                        HorizontalDivider(
                            modifier  = Modifier.padding(horizontal = 20.dp),
                            color     = colors.rule,
                            thickness = 0.5.dp,
                        )
                    }
                }
            }
        }
    }

    // ── Appearance bottom sheet ────────────────────────────────────────────────
    if (showAppearanceSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAppearanceSheet = false },
            containerColor   = colors.paper,
            contentColor     = colors.ink,
        ) {
            Column(modifier = Modifier.padding(bottom = 32.dp)) {
                Text(
                    text     = "Appearance",
                    style    = MaterialTheme.typography.titleMedium.copy(color = colors.ink),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                )
                listOf(
                    SettingsStore.THEME_SYSTEM to "System default",
                    SettingsStore.THEME_LIGHT  to "Light",
                    SettingsStore.THEME_DARK   to "Dark",
                ).forEach { (mode, label) ->
                    val selected = settingsStore.themeMode == mode
                    Row(
                        modifier              = Modifier
                            .fillMaxWidth()
                            .clickable {
                                settingsStore.setThemeMode(mode)
                                showAppearanceSheet = false
                            }
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text  = label,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = if (selected) colors.accent else colors.ink,
                            ),
                        )
                        if (selected) {
                            Icon(
                                Icons.Rounded.Check,
                                null,
                                tint     = colors.accent,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Shared sub-components ──────────────────────────────────────────────────────

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    val colors = CinemoodTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(colors.paper2),
        content  = content,
    )
}

@Composable
private fun SettingsSectionLabel(label: String) {
    val colors = CinemoodTheme.colors
    Text(
        text     = label.uppercase(),
        style    = MaterialTheme.typography.labelSmall.copy(
            color         = colors.faint,
            letterSpacing = 1.sp,
        ),
        modifier = Modifier.padding(horizontal = 4.dp),
    )
}

@Composable
private fun SettingsRow(
    icon:     ImageVector,
    title:    String,
    value:    String,
    tint:     Color,
    onClick:  (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val colors = CinemoodTheme.colors
    Row(
        modifier              = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp))
        Text(
            text     = title,
            style    = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
            modifier = Modifier.weight(1f),
        )
        if (value.isNotEmpty()) {
            Text(value, style = MaterialTheme.typography.bodySmall.copy(color = colors.faint))
        }
        if (onClick != null) {
            Icon(
                Icons.Rounded.ChevronRight,
                null,
                tint     = colors.faint,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}
