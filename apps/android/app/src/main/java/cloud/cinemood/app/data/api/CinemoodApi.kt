package cloud.cinemood.app.data.api

import cloud.cinemood.app.data.auth.TokenStore
import cloud.cinemood.app.data.model.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.bodyAsText
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private const val BASE_URL = "https://cinemood.sayantan.cloud"

class CinemoodApi(private val tokenStore: TokenStore) {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues  = true
    }

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(json)
        }
    }

    private fun HttpRequestBuilder.bearer() {
        val token = tokenStore.getToken() ?: return
        header(HttpHeaders.Authorization, "Bearer $token")
    }

    // ── Watchlist ─────────────────────────────────────────────────────────────

    suspend fun listWatchlist(
        status: String? = null,
        type: String? = null,
        sort: String = "added_desc",
        limit: Int = 200,
    ): Result<List<WatchlistItem>> = runCatching {
        val response: ApiResponse<List<WatchlistItem>> = client.get("$BASE_URL/api/watchlist") {
            bearer()
            if (status != null) parameter("status", status)
            if (type   != null) parameter("type",   type)
            parameter("sort",  sort)
            parameter("limit", limit)
        }.body()
        response.data ?: error(response.error?.message ?: "Empty response")
    }

    suspend fun setStatus(titleId: Int, status: String): Result<WatchlistItem> = runCatching {
        val response: ApiResponse<WatchlistItem> = client.patch("$BASE_URL/api/watchlist/$titleId") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(mapOf("status" to status)))
        }.body()
        response.data ?: error(response.error?.message ?: "Empty response")
    }

    suspend fun removeFromWatchlist(titleId: Int): Result<Unit> = runCatching {
        client.delete("$BASE_URL/api/watchlist/$titleId") { bearer() }
        Unit
    }

    suspend fun addToWatchlist(tmdbId: Int, type: String): Result<WatchlistItem> = runCatching {
        val response: ApiResponse<WatchlistItem> = client.post("$BASE_URL/api/watchlist") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody("""{"tmdb_id":$tmdbId,"type":"$type"}""")
        }.body()
        response.data ?: error(response.error?.message ?: "Empty response")
    }

    // ── Search ────────────────────────────────────────────────────────────────

    suspend fun getTitle(type: String, id: Int): Result<Title> = runCatching {
        // Use bodyAsText + manual decode per CLAUDE.md learned rule:
        // Ktor ContentNegotiation fails on generic types on non-2xx paths.
        val text = client.get("$BASE_URL/api/title/$type/$id") {
            bearer()
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<Title>>(text)
        response.data ?: error(response.error?.message ?: "Title fetch failed")
    }

    suspend fun getPerson(id: Int): Result<PersonDetail> = runCatching {
        val text = client.get("$BASE_URL/api/person/$id") {
            bearer()
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<PersonDetail>>(text)
        response.data ?: error(response.error?.message ?: "Person fetch failed")
    }

    suspend fun searchTmdb(query: String): Result<List<TmdbResult>> = runCatching {
        val response: ApiResponse<List<TmdbResult>> = client.get("$BASE_URL/api/search/tmdb") {
            bearer()
            parameter("q", query)
        }.body()
        response.data ?: emptyList()
    }

    suspend fun nlSearch(query: String): Result<SearchResult> = runCatching {
        // Use bodyAsText + manual decode per CLAUDE.md learned rule:
        // Ktor ContentNegotiation fails on generic types on non-2xx paths.
        val text = client.post("$BASE_URL/api/search") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody("""{"query":${json.encodeToString(query)}}""")
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<SearchResult>>(text)
        response.data ?: SearchResult()
    }

    suspend fun discover(query: String): Result<DiscoverResult> = runCatching {
        val text = client.post("$BASE_URL/api/discover") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody("""{"query":${json.encodeToString(query)}}""")
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<DiscoverResult>>(text)
        response.data ?: DiscoverResult()
    }

    // ── Recommend ─────────────────────────────────────────────────────────────

    suspend fun recommend(
        mood: String,
        status: String? = null,
        limit: Int = 10,
    ): Result<RecommendResponse> = runCatching {
        @kotlinx.serialization.Serializable
        data class Req(
            val mood: String,
            val limit: Int,
            val status: String? = null,
        )
        val response: ApiResponse<RecommendResponse> = client.post("$BASE_URL/api/recommend") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(Req(mood, limit, status)))
        }.body()
        response.data ?: RecommendResponse()
    }

    // ── Compare ───────────────────────────────────────────────────────────────

    suspend fun compare(titleIds: List<Int>): Result<CompareResponse> = runCatching {
        val response: ApiResponse<CompareResponse> = client.post("$BASE_URL/api/compare") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CompareRequest(titleIds)))
        }.body()
        response.data ?: CompareResponse()
    }

    // ── Decide Q&A ────────────────────────────────────────────────────────────

    suspend fun decideQuestions(
        titleIds: List<Int>? = null,
        status: String? = null,
        count: Int = 5,
    ): Result<DecideQuestionsResponse> = runCatching {
        val text = client.post("$BASE_URL/api/decide/questions") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(DecideQuestionsRequest(titleIds, status, count)))
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<DecideQuestionsResponse>>(text)
        response.data ?: DecideQuestionsResponse()
    }

    suspend fun decidePick(
        titleIds: List<Int>,
        answers: List<SwipeAnswer>,
        mood: String? = null,
    ): Result<DecidePickResponse> = runCatching {
        val text = client.post("$BASE_URL/api/decide/pick") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(DecidePickRequest(titleIds, answers, mood)))
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<DecidePickResponse>>(text)
        response.data ?: error(response.error?.message ?: "Could not pick a title")
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    suspend fun getMe(): Result<UserProfile> = runCatching {
        val response: ApiResponse<UserProfile> = client.get("$BASE_URL/api/me") {
            bearer()
        }.body()
        response.data ?: error(response.error?.message ?: "Not signed in")
    }

    // ── Device auth exchange ──────────────────────────────────────────────────
    suspend fun exchangeDeviceCode(code: String): Result<DeviceExchangeResult> = runCatching {
        val text = client.post("$BASE_URL/api/auth/device-exchange") {
            contentType(ContentType.Application.Json)
            setBody("""{"code":${json.encodeToString(code)}}""")
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<DeviceExchangeResult>>(text)
        response.data ?: error(response.error?.message ?: "Exchange failed")
    }
}
