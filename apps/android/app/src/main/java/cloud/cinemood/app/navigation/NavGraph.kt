package cloud.cinemood.app.navigation

sealed class Screen(val route: String) {
    data object SignIn    : Screen("signin")
    data object Home      : Screen("home")
    data object Watchlist : Screen("watchlist")
    data object Decide    : Screen("decide")
    data object Settings  : Screen("settings")
    data object Search    : Screen("search")
    data object Detail    : Screen("detail/{titleId}") {
        fun createRoute(titleId: Int) = "detail/$titleId"
    }
}
