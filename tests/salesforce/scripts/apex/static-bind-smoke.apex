Account acme = [
  SELECT Id, Name
  FROM Account
  WHERE Name = 'Kysoql Test Acme'
];

String accountName = 'Kysoql Test Acme';
List<Account> scalarBind = [
  SELECT Id
  FROM Account
  WHERE Name = :accountName
];
System.assertEquals(1, scalarBind.size(), 'scalar bind');

Set<Id> accountIds = new Set<Id>{ acme.Id };
List<Account> collectionBind = [
  SELECT Id
  FROM Account
  WHERE Id IN :accountIds
];
System.assertEquals(1, collectionBind.size(), 'collection bind');

List<Account> memberPathBind = [
  SELECT Id
  FROM Account
  WHERE Id = :acme.Id
];
System.assertEquals(1, memberPathBind.size(), 'member-path bind');

acme.Type = 'Customer - Direct; Customer - Channel';
Account bindLeftIncludes = [
  SELECT Id
  FROM Account
  WHERE :acme.Type INCLUDES ('Customer - Direct; Customer - Channel')
  AND Id = :acme.Id
];
System.assertEquals(acme.Id, bindLeftIncludes.Id, 'bind-left INCLUDES');

String contactLastName = 'Lovelace';
List<Account> relationshipSubqueryBind = [
  SELECT Id, (SELECT Id FROM Contacts WHERE LastName = :contactLastName)
  FROM Account
  WHERE Id = :acme.Id
];
System.assertEquals(1, relationshipSubqueryBind.size(), 'relationship subquery root');
System.assertEquals(
  1,
  relationshipSubqueryBind[0].Contacts.size(),
  'relationship subquery bind'
);

String accountPrefix = 'Kysoql Test';
List<Account> additionBind = [
  SELECT Id
  FROM Account
  WHERE Name LIKE :(accountPrefix + ' %')
  ORDER BY Name
];
System.assertEquals(2, additionBind.size(), 'addition bind');

String paddedAccountName = 'Kysoql Test Acme suffix';
List<Account> substringBind = [
  SELECT Id
  FROM Account
  WHERE Name = :paddedAccountName.substring(0, 16)
];
System.assertEquals(1, substringBind.size(), 'substring bind');

List<Account> queryResultBind = [
  SELECT Id
  FROM Account
  WHERE Name = :[SELECT Name FROM Account WHERE Id = :acme.Id].Name
];
System.assertEquals(1, queryResultBind.size(), 'query-result bind');

Integer rowLimit = 1;
Integer rowOffset = 1;
List<Account> paginationBind = [
  SELECT Id
  FROM Account
  WHERE Name LIKE 'Kysoql Test %'
  ORDER BY Name
  LIMIT :rowLimit
  OFFSET :rowOffset
];
System.assertEquals(1, paginationBind.size(), 'pagination binds');
