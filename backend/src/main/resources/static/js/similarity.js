async function checkSimilarity(logoId) {
    const response = await fetch('/similarity/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoId })
    });
    return await response.json();
}
