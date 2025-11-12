import { Card, CardBody, CardTitle, CardText, Container } from "reactstrap";

const Home = () => {
  return (
    <Container className="mt-4">
      <Card>
        <CardBody>
          <CardTitle tag="h2">Welcome to Bandmate</CardTitle>
          <CardText>Manage your songs and stay organized with Bandmate.</CardText>
        </CardBody>
      </Card>
    </Container>
  );
};

export default Home;
