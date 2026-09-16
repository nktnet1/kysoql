List<Kysoql_Record__c> oldRecords = [
  SELECT Id FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%'
];
if (!oldRecords.isEmpty()) {
  delete oldRecords;
}

List<Contact> oldContacts = [
  SELECT Id FROM Contact WHERE Email LIKE '%@kysoql.example'
];
if (!oldContacts.isEmpty()) {
  delete oldContacts;
}

List<Account> oldAccounts = [
  SELECT Id FROM Account WHERE Name LIKE 'Kysoql Test %'
];
if (!oldAccounts.isEmpty()) {
  delete oldAccounts;
}

Account acme = new Account(Name = 'Kysoql Test Acme', Industry = 'Technology');
Account globex = new Account(Name = 'Kysoql Test Globex', Industry = 'Energy');
insert new List<Account>{ acme, globex };

insert new List<Contact>{
  new Contact(FirstName = 'Ada', LastName = 'Lovelace', Email = 'ada@kysoql.example', AccountId = acme.Id),
  new Contact(FirstName = 'Grace', LastName = 'Hopper', Email = 'grace@kysoql.example', AccountId = acme.Id),
  new Contact(FirstName = 'Edsger', LastName = 'Dijkstra', Email = 'edsger@kysoql.example', AccountId = globex.Id)
};

insert new List<Kysoql_Record__c>{
  new Kysoql_Record__c(Name = 'Alpha One', External_Id__c = 'KYSOQL-001', Amount__c = 100.50, Active__c = true, Category__c = 'Alpha', Occurred_On__c = Date.newInstance(2026, 1, 15), Account__c = acme.Id),
  new Kysoql_Record__c(Name = 'Beta One', External_Id__c = 'KYSOQL-002', Amount__c = 250.00, Active__c = true, Category__c = 'Beta', Occurred_On__c = Date.newInstance(2026, 2, 20), Account__c = acme.Id),
  new Kysoql_Record__c(Name = 'Gamma One', External_Id__c = 'KYSOQL-003', Amount__c = 75.25, Active__c = false, Category__c = 'Gamma', Occurred_On__c = Date.newInstance(2026, 3, 5), Account__c = globex.Id)
};
