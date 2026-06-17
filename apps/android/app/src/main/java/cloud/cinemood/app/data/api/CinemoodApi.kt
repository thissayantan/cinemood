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
import kotlinx.serialization.json.Json

private const val BASE_URL = "https://cinemood.sayantan.cloud"

/**
 * Ktor-backed HTTP client for the Cinemood API.
 *
 * All requests are authenticated with the stored Bearer token.
 * Responses follow the { ok, data, error } envelope — callers receive
 * typed Result<T> and must handle errors explicitly.
 */
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
            setBody("""{"status":"$status"}""")
        }.body()
        response.data ?: error(response.error?.message ?: "Empty response")
    }

    suspend fun removeFromWatchlist(titleId: Int): Result<Unit> = runCatching {
        client.delete("$BASE_URL/api/watchlist/$titleId") {
            bearer()
        }
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

    suspend fun searchTmdb(query: String): Result<List<TmdbResult>> = runCatching {
        val response: ApiResponse<List<TmdbResult>> = client.get("$BASE_URL/api/search/tmdb") {
            bearer()
            parameter("q", query)
        }.body()
        response.data ?: emptyList()
    }

    suspend fun nlSearch(query: String): Result<SearchResult> = runCatching {
        val response: ApiResponse<SearchResult> = client.post("$BASE_URL/api/search") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody("""{"query":"${query.replace("\"", "\\\"")}"}""")
        }.body()
        response.data ?: SearchResult()
    }

    // ── Recommend ─────────────────────────────────────────────────────────────

    suspend fun recommend(
        mood: String,
        status: String? = null,
        limit: Int = 10,
    ): Result<RecommendResponse> = runCatching {
        val statusPart = if (status != null) ""","status":"$status"""" else ""
        val body = """{"mood":"${mood.replace("\"","\\\"")}","limit":$limit$statusPart}"""
        val response: ApiResponse<RecommendResponse> = client.post("$BASE_URL/api/recommend") {
            bearer()
            contentType(ContentType.Application.Json)
            setBody(body)
        }.body()
        response.data ?: RecommendResponse(emptyList())
    }

    // ── Device auth exchange ──────────────────────────────────────────────────
    //
    // Uses bodyAsText + manual decodeFromString to avoid Ktor ContentNegotiation
    // failing to resolve the generic serializer on non-2xx response paths.
    suspend fun exchangeDeviceCode(code: String): Result<DeviceExchangeResult> = runCatching {
        val text = client.post("$BASE_URL/api/auth/device-exchange") {
            contentType(ContentType.Application.Json)
            setBody("""{"code":"${code.replace("\"","\\\"")}"}""")
        }.bodyAsText()
        val response = json.decodeFromString<ApiResponse<DeviceExchangeResult>>(text)
        response.data ?: error(response.error?.message ?: "Exchange failed")
    }
}
