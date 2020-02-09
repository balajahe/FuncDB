BigData ERP-system prototype, based on original functional NoSQL DBMS, which professes the principles of functional programming. Any entity in the database is a document (a kind of <a href="https://martinfowler.com/eaaDev/EventSourcing.html">event sourcing</a> approach). Database is essentially a chronologically ordered document journal. This journal is divided into 2 parts - immutable and mutable. The first is a map/reduce storage, the second is an in-memory database. Series of articles in Russian:<br>
https://habr.com/ru/post/482938/<br>
https://habr.com/ru/post/485508/
