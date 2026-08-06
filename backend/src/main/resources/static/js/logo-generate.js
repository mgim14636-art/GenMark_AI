async function generateLogo(projectId, prompt) {
    const response = await fetch('/logo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt })
    });
    return await response.json();
}
