package cloud.cinemood.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cloud.cinemood.app.ui.screens.LibraryFacets
import cloud.cinemood.app.ui.screens.LibraryFilters
import cloud.cinemood.app.ui.screens.SORT_LABELS
import cloud.cinemood.app.ui.theme.CinemoodTheme
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FilterSheet(
    filters:    LibraryFilters,
    facets:     LibraryFacets,
    onFilters:  (LibraryFilters) -> Unit,
    onDismiss:  () -> Unit,
) {
    val colors       = CinemoodTheme.colors
    val currentYear  = remember { Calendar.getInstance().get(Calendar.YEAR) }

    ModalBottomSheet(
        onDismissRequest  = onDismiss,
        containerColor    = colors.paper,
        contentColor      = colors.ink,
        dragHandle        = { BottomSheetDefaults.DragHandle(color = colors.rule) },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // ── Header ─────────────────────────────────────────────────────
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically,
            ) {
                Text(
                    "Filters & Sort",
                    style = MaterialTheme.typography.titleMedium.copy(
                        color = colors.ink, fontWeight = FontWeight.Bold,
                    ),
                )
                TextButton(onClick = { onFilters(LibraryFilters()); onDismiss() }) {
                    Text(
                        "Reset all",
                        style = MaterialTheme.typography.labelMedium.copy(color = colors.accent),
                    )
                }
            }

            HorizontalDivider(color = colors.rule, thickness = 0.5.dp)

            // ── 1. Type ────────────────────────────────────────────────────
            FilterSection(label = "Type") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(null to "All", "movie" to "Movies", "series" to "Series").forEach { (value, label) ->
                        val selected = filters.type == value
                        FilterChipItem(
                            label    = label,
                            selected = selected,
                            onClick  = {
                                onFilters(filters.copy(type = if (selected && value != null) null else value))
                            },
                        )
                    }
                }
            }

            // ── 2. Status ──────────────────────────────────────────────────
            FilterSection(label = "Status") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        null       to "All",
                        "pending"  to "To watch",
                        "watching" to "Watching",
                        "watched"  to "Watched",
                    ).forEach { (value, label) ->
                        val selected = filters.status == value
                        FilterChipItem(
                            label    = label,
                            selected = selected,
                            // Status: tapping "All" clears; cannot toggle off a non-null selection
                            onClick  = { onFilters(filters.copy(status = value)) },
                        )
                    }
                }
            }

            // ── 3. Sort ────────────────────────────────────────────────────
            FilterSection(label = "Sort") {
                SortDropdown(
                    selected = filters.sort,
                    onSelect = { onFilters(filters.copy(sort = it)) },
                )
            }

            // ── 4. Genre ───────────────────────────────────────────────────
            if (facets.genres.isNotEmpty()) {
                FilterSection(label = "Genre") {
                    ChipWrap {
                        facets.genres.forEach { genre ->
                            val selected = filters.genre == genre
                            FilterChipItem(
                                label    = genre,
                                selected = selected,
                                onClick  = {
                                    onFilters(filters.copy(genre = if (selected) null else genre))
                                },
                            )
                        }
                    }
                }
            }

            // ── 5. Release year ────────────────────────────────────────────
            FilterSection(label = "Release year") {
                val yearMin = filters.yearMin?.toFloat() ?: 1920f
                val yearMax = filters.yearMax?.toFloat() ?: currentYear.toFloat()

                Text(
                    text  = "${yearMin.toInt()} – ${yearMax.toInt()}",
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                )
                RangeSlider(
                    value          = yearMin..yearMax,
                    onValueChange  = { r ->
                        val lo = r.start.toInt()
                        val hi = r.endInclusive.toInt()
                        onFilters(filters.copy(
                            yearMin = if (lo <= 1920) null else lo,
                            yearMax = if (hi >= currentYear) null else hi,
                        ))
                    },
                    valueRange     = 1920f..currentYear.toFloat(),
                    colors         = SliderDefaults.colors(
                        thumbColor            = colors.accent,
                        activeTrackColor      = colors.accent,
                        inactiveTrackColor    = colors.rule,
                    ),
                )
                // Decade pills
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    DECADES.forEach { (label, from, to) ->
                        val active = filters.yearMin == from && filters.yearMax == to
                        FilterChipItem(
                            label   = label,
                            selected = active,
                            onClick  = {
                                onFilters(if (active) {
                                    filters.copy(yearMin = null, yearMax = null)
                                } else {
                                    filters.copy(yearMin = from, yearMax = to)
                                })
                            },
                            mono = true,
                        )
                    }
                }
            }

            // ── 6. Min rating ──────────────────────────────────────────────
            FilterSection(label = "Min rating") {
                val rating = filters.minRating ?: 0f
                Text(
                    text  = if (rating > 0f) "≥ ${"%.1f".format(rating)}★" else "Any",
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                )
                Slider(
                    value          = rating,
                    onValueChange  = { v ->
                        val rounded = (v * 2).toInt() / 2f  // round to 0.5
                        onFilters(filters.copy(minRating = if (rounded <= 0f) null else rounded))
                    },
                    valueRange     = 0f..10f,
                    colors         = SliderDefaults.colors(
                        thumbColor         = colors.accent,
                        activeTrackColor   = colors.accent,
                        inactiveTrackColor = colors.rule,
                    ),
                )
            }

            // ── 7. Runtime ─────────────────────────────────────────────────
            FilterSection(label = "Runtime (min)") {
                val rtMin = filters.runtimeMin?.toFloat() ?: 0f
                val rtMax = filters.runtimeMax?.toFloat() ?: 240f

                Text(
                    text  = "${rtMin.toInt()}m – ${rtMax.toInt()}m",
                    style = MaterialTheme.typography.bodySmall.copy(color = colors.dim),
                )
                RangeSlider(
                    value          = rtMin..rtMax,
                    onValueChange  = { r ->
                        val lo = (r.start / 15).toInt() * 15
                        val hi = (r.endInclusive / 15).toInt() * 15
                        onFilters(filters.copy(
                            runtimeMin = if (lo <= 0) null else lo,
                            runtimeMax = if (hi >= 240) null else hi,
                        ))
                    },
                    valueRange     = 0f..240f,
                    colors         = SliderDefaults.colors(
                        thumbColor            = colors.accent,
                        activeTrackColor      = colors.accent,
                        inactiveTrackColor    = colors.rule,
                    ),
                )
            }

            // ── 8. Streaming providers ─────────────────────────────────────
            if (facets.providers.isNotEmpty()) {
                FilterSection(label = "Streaming on") {
                    ChipWrap {
                        facets.providers.forEach { provider ->
                            val selected = filters.providers.contains(provider)
                            FilterChipItem(
                                label    = provider,
                                selected = selected,
                                onClick  = {
                                    val updated = if (selected)
                                        filters.providers - provider
                                    else
                                        filters.providers + provider
                                    onFilters(filters.copy(providers = updated))
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Sort dropdown ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SortDropdown(selected: String, onSelect: (String) -> Unit) {
    val colors    = CinemoodTheme.colors
    var expanded  by remember { mutableStateOf(false) }
    val label     = SORT_LABELS[selected] ?: "Recently added"

    ExposedDropdownMenuBox(
        expanded         = expanded,
        onExpandedChange = { expanded = it },
    ) {
        OutlinedTextField(
            value         = label,
            onValueChange = {},
            readOnly      = true,
            modifier      = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            trailingIcon  = {
                Icon(Icons.Rounded.ExpandMore, null, tint = colors.dim)
            },
            shape         = RoundedCornerShape(10.dp),
            colors        = OutlinedTextFieldDefaults.colors(
                focusedBorderColor   = colors.accent,
                unfocusedBorderColor = colors.rule,
                focusedTextColor     = colors.ink,
                unfocusedTextColor   = colors.ink,
            ),
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
        )
        ExposedDropdownMenu(
            expanded         = expanded,
            onDismissRequest = { expanded = false },
            modifier         = Modifier.background(colors.paper),
        ) {
            SORT_LABELS.entries.forEach { (key, displayLabel) ->
                DropdownMenuItem(
                    text = {
                        Text(
                            displayLabel,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color      = if (key == selected) colors.accent else colors.ink,
                                fontWeight = if (key == selected) FontWeight.Bold else FontWeight.Normal,
                            ),
                        )
                    },
                    onClick = {
                        onSelect(key)
                        expanded = false
                    },
                )
            }
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

@Composable
private fun FilterSection(
    label:   String,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = CinemoodTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text  = label.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(
                color         = colors.faint,
                fontSize      = 10.sp,
                letterSpacing = 1.sp,
            ),
        )
        content()
    }
}

/** Multi-line wrapping chip layout using nested Rows. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipWrap(content: @Composable FlowRowScope.() -> Unit) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement   = Arrangement.spacedBy(6.dp),
        content               = content,
    )
}

@Composable
fun FilterChipItem(
    label:    String,
    selected: Boolean,
    onClick:  () -> Unit,
    mono:     Boolean = false,
) {
    val colors = CinemoodTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) colors.accent else colors.paper2)
            .clickable(onClick = onClick)
            .padding(
                horizontal = if (mono) 10.dp else 14.dp,
                vertical   = if (mono) 4.dp else 7.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text  = if (mono) label.uppercase() else label,
            style = MaterialTheme.typography.labelSmall.copy(
                color         = if (selected) Color.White else colors.dim,
                fontSize      = if (mono) 10.sp else 12.sp,
                letterSpacing = if (mono) 0.5.sp else 0.sp,
                fontWeight    = if (mono) FontWeight.Medium else FontWeight.Normal,
            ),
        )
    }
}

// ── Constants ─────────────────────────────────────────────────────────────────

private data class Decade(val label: String, val from: Int, val to: Int)

private val DECADES = listOf(
    Decade("'70s", 1970, 1979),
    Decade("'80s", 1980, 1989),
    Decade("'90s", 1990, 1999),
    Decade("'00s", 2000, 2009),
    Decade("'10s", 2010, 2019),
    Decade("'20s", 2020, 2029),
)
