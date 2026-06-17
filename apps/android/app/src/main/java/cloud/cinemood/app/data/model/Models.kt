package cloud.cinemood.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WatchlistItem(
    val id: Int,
    val title: String,
    val type: String,
    val year: Int? = null,
    val runtime: Int? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    val overview: String? = null,
    val genres: List<String> = emptyList(),
    @SerialName("vote_average") val voteAverage: Double? = null,
    @SerialName("imdb_rating") val imdbRating: Double? = null,
    val status: String,
    @SerialName("added_at") val addedAt: Long,
    @SerialName("started_at") val startedAt: Long? = null,
    @SerialName("watched_at") val watchedAt: Long? = null,
    val providers: List<String> = emptyList(),
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
    val item: WatchlistItem? = null,
)

@Serializable
data class RecommendResponse(
    val recommendations: List<Recommendation>,
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

// Wrapper for the { ok, data } envelope
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
