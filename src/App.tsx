import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "reactstrap";
import { supabase } from "./supabaseClient";

const Container = styled.div`
  padding: 2rem;
  background: #121212;
  color: white;
  min-height: 100vh;
`;

function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session)
    );
    return () => listener?.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: "github" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Container>
      <h1>Bandmate</h1>
      {session ? (
        <>
          <p>Welcome, {session.user.email}</p>
          <Button color="danger" onClick={signOut}>
            Sign Out
          </Button>
        </>
      ) : (
        <Button color="primary" onClick={signIn}>
          Sign in with GitHub
        </Button>
      )}
    </Container>
  );
}

export default App;
