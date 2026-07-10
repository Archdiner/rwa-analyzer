// SSRF guard: the server-side doc fetcher must refuse non-https and
// loopback/private/link-local/metadata hosts BEFORE issuing any network call.
// Each of these returns null via the guard, so the test needs no network.
import { fetchDocText } from "@/lib/ingestion/adapters/issuer-docs";

describe("fetchDocText SSRF guard", () => {
    const blocked = [
        "http://example.com/doc.pdf", // non-https
        "https://localhost/doc.pdf",
        "https://127.0.0.1/doc.pdf",
        "https://169.254.169.254/latest/meta-data/", // cloud metadata
        "https://metadata.google.internal/",
        "https://192.168.1.10/doc.pdf",
        "https://10.0.0.5/doc.pdf",
        "https://[::1]/doc.pdf",
        "not-a-url",
    ];

    it.each(blocked)("refuses %s", async (url) => {
        await expect(fetchDocText(url)).resolves.toBeNull();
    });
});
