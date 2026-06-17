package cloud.cinemood.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class Title(
    val id: Int,
    val type: String,
    val title: String,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    val overview: String? = null,
    val genres: List<String> = emptyList(),
    val runtime: Int? = null,
    @SerialName("vote_average") val voteAverage: Double? = null,
    @SerialName("vote_count") val voteCount: Int? = null,
    @SerialName("imdb_id") val imdbId: String? = null,
    @SerialName("imdb_rating") val imdbRating: Double? = null,
    val providers: JsonObject? = null,
)

// Provider names come from the object keys (e.g. "Netflix", "Prime Video")
val Title.providerNames: List<String>
    get() = providers?.keys?.toList() ?: emptyList()

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
    val score: Int,
    val reason: String,
)

@Serializable
data class RecommendResponse(
    val recommendations: List<Recommendation> = emptyList(),
    val items: List<WatchlistItem> = emptyList(),
    val mood: String = "",
)

@Serializable
data class SearchResult(
    val hits: List<WatchlistItem> = emptyList(),
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
