import SwiftUI

struct ContentView: View {
    // Replace with your production URL
    let appURL = URL(string: "https://mealchart.vercel.app/?utm_source=ios")!

    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            WebView(url: appURL)
                .edgesIgnoringSafeArea(.bottom) // Keep top safe area for status bar if preferred
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
