package cloud.cinemood.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

@Serializable
data class CastMember(
    val id: Int = 0,
    val name: String,
    val character: String? = null,
    @SerialName("profile_path") val profilePath: String? = null,
)

@Serializable
data class PersonCredit(
    val id: Int,
    val type: String,
    val title: String,
    @SerialName("poster_path") val posterPath: String? = null,
    val character: String? = null,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("vote_average") val voteAverage: Double? = null,
    val popularity: Double? = null,
)

@Serializable
data class PersonDetail(
    val id: Int,
    val name: String,
    val biography: String? = null,
    @SerialName("profile_path") val profilePath: String? = null,
    val birthday: String? = null,
    @SerialName("known_for_department") val knownForDepartment: String? = null,
    @SerialName("place_of_birth") val placeOfBirth: String? = null,
    val credits: List<PersonCredit> = emptyList(),
)

data class ProviderInfo(val name: String, val logoPath: String?)

// ── Episode / Season data classes ─────────────────────────────────────────────

@Serializable
data class Episode(
    @SerialName("air_date") val airDate: String? = null,
    @SerialName("episode_number") val episodeNumber: Int,
    @SerialName("season_number") val seasonNumber: Int,
    val name: String? = null,
    @SerialName("still_path") val stillPath: String? = null,
    val overview: String? = null,
    val runtime: Int? = null,
    @SerialName("vote_average") val voteAverage: Double? = null,
)

@Serializable
data class Season(
    @SerialName("season_number") val seasonNumber: Int,
    val name: String,
    @SerialName("episode_count") val episodeCount: Int,
    @SerialName("air_date") val airDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    val overview: String? = null,
)

@Serializable
data class SeasonDetail(
    @SerialName("series_id") val seriesId: Int,
    @SerialName("season_number") val seasonNumber: Int,
    val name: String,
    val overview: String? = null,
    @SerialName("air_date") val airDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    val episodes: List<Episode> = emptyList(),
)

// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class Title(
    val id: Int,
    val type: String,
    val title: String,
    @SerialName("original_title") val originalTitle: String? = null,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    val overview: String? = null,
    val genres: List<String> = emptyList(),
    val cast: List<CastMember> = emptyList(),
    val keywords: List<String> = emptyList(),
    val runtime: Int? = null,
    @SerialName("vote_average") val voteAverage: Double? = null,
    @SerialName("vote_count") val voteCount: Int? = null,
    @SerialName("imdb_id") val imdbId: String? = null,
    @SerialName("imdb_rating") val imdbRating: Double? = null,
    val providers: JsonObject? = null,
    // Series-only episode metadata (absent/null for movies)
    @SerialName("number_of_seasons") val numberOfSeasons: Int? = null,
    @SerialName("number_of_episodes") val numberOfEpisodes: Int? = null,
    val seasons: List<Season>? = null,
    @SerialName("next_episode_to_air") val nextEpisodeToAir: Episode? = null,
    @SerialName("last_episode_to_air") val lastEpisodeToAir: Episode? = null,
)

fun Title.streamingProviders(region: String = "US"): List<ProviderInfo> {
    val json = providers ?: return emptyList()

    fun infosFromRegion(code: String): List<ProviderInfo> {
        val regionObj = json[code] as? JsonObject ?: return emptyList()
        val flatrate = regionObj["flatrate"] as? JsonArray ?: return emptyList()
        return flatrate.mapNotNull { entry ->
            val obj = entry as? JsonObject ?: return@mapNotNull null
            val name = obj["provider_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val logo = obj["logo_path"]?.jsonPrimitive?.contentOrNull
            ProviderInfo(name, logo)
        }
    }

    val preferred = region.uppercase().ifBlank { "US" }
    return (infosFromRegion(preferred)
        .ifEmpty { infosFromRegion("US") }
        .ifEmpty { json.keys.flatMap { infosFromRegion(it) } })
        .distinctBy { it.name }
        .take(8)
}

@Serializable
data class WatchlistItem(
    val title: Title,
    val status: String,
    @SerialName("added_at") val addedAt: Long,
    @SerialName("started_at") val startedAt: Long? = null,
    @SerialName("watched_at") val watchedAt: Long? = null,
    val notes: String? = null,
    @SerialName("catalog_no") val catalogNo: Int,
)

@Serializable
data class TmdbResult(
    val id: Int,
    val type: String,
    val title: String,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("vote_average") val voteAverage: Double? = null,
    val overview: String? = null,
)

@Serializable
data class Recommendation(
    @SerialName("title_id") val titleId: Int,
    val score: Double,
    val reason: String,
)

@Serializable
data class RecommendResponse(
    val recommendations: List<Recommendation> = emptyList(),
    val items: List<WatchlistItem> = emptyList(),
    val mood: String = "",
)

// ── AI search / discover ──────────────────────────────────────────────────────

@Serializable
data class ParsedQueryFilters(
    val type: List<String>? = null,
    val genres: List<String>? = null,
    @SerialName("exclude_genres") val excludeGenres: List<String>? = null,
    @SerialName("min_rating") val minRating: Double? = null,
    @SerialName("max_rating") val maxRating: Double? = null,
    @SerialName("release_after") val releaseAfter: String? = null,
    @SerialName("release_before") val releaseBefore: String? = null,
    val cast: List<String>? = null,
    val keywords: List<String>? = null,
    val providers: List<String>? = null,
)

@Serializable
data class ParsedQuery(
    val filters: ParsedQueryFilters = ParsedQueryFilters(),
    @SerialName("semantic_query") val semanticQuery: String = "",
)

/** Response from POST /api/search (library NL search). */
@Serializable
data class SearchResult(
    // The server field is "results", not "hits" — serialName is critical here.
    @SerialName("results") val results: List<WatchlistItem> = emptyList(),
    val parsed: ParsedQuery? = null,
)

/** Response from POST /api/discover (TMDB discovery). */
@Serializable
data class DiscoverResult(
    val parsed: ParsedQuery? = null,
    val results: List<TmdbResult> = emptyList(),
)

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    val name: String? = null,
    val picture: String? = null,
)

@Serializable
data class DeviceExchangeResult(
    val token: String,
    val prefix: String,
    val name: String,
)

@Serializable
data class ApiResponse<T>(
    val ok: Boolean,
    val data: T? = null,
    val error: ApiError? = null,
)

@Serializable
data class ApiError(
    val code: String,
    val message: String,
)

// ── Compare ───────────────────────────────────────────────────────────────────

@Serializable
data class CompareRequest(@SerialName("title_ids") val titleIds: List<Int>)

@Serializable
data class CompareCell(
    @SerialName("title_id") val titleId: Int,
    val title: String,
    val year: String? = null,
    val type: String,
    val runtime: Int? = null,
    val genres: List<String> = emptyList(),
    val providers: List<String> = emptyList(),
    @SerialName("vote_average") val voteAverage: Double? = null,
    @SerialName("imdb_rating") val imdbRating: Double? = null,
    val mood: String = "",
    val pacing: String = "",
    val tone: String = "",
    @SerialName("critical_consensus") val criticalConsensus: String = "",
    @SerialName("watch_if_you_liked") val watchIfYouLiked: List<String> = emptyList(),
)

@Serializable
data class CompareResponse(val rows: List<CompareCell> = emptyList())

// ── Decide swipe Q&A ──────────────────────────────────────────────────────────

@Serializable
data class SwipeOption(val id: String, val label: String)

@Serializable
data class SwipeQuestion(
    val id: String,
    val prompt: String,
    val options: List<SwipeOption> = emptyList(),
)

@Serializable
data class DecideQuestionsRequest(
    @SerialName("title_ids") val titleIds: List<Int>? = null,
    val status: String? = null,
    val count: Int = 5,
)

@Serializable
data class DecideQuestionsResponse(
    val questions: List<SwipeQuestion> = emptyList(),
    @SerialName("candidate_ids") val candidateIds: List<Int> = emptyList(),
)

@Serializable
data class SwipeAnswer(
    @SerialName("question_id") val questionId: String,
    @SerialName("option_id") val optionId: String,
)

@Serializable
data class DecidePickRequest(
    @SerialName("title_ids") val titleIds: List<Int>,
    val answers: List<SwipeAnswer>,
    val mood: String? = null,
)

@Serializable
data class RunnerUp(val item: WatchlistItem, val reason: String)

@Serializable
data class DecidePickResponse(
    val winner: WatchlistItem,
    val reason: String,
    @SerialName("runners_up") val runnersUp: List<RunnerUp> = emptyList(),
)
