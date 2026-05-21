function HomePage() {
  return (
    <div className="editor-page">
      <div className="editor-status">
        <p>Open a project editor at <code>/projects/:id</code></p>
        <p>Ensure <code>localStorage.token</code> is set from login.</p>
      </div>
    </div>
  );
}

export default HomePage;
