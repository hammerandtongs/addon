/* ***** BEGIN LICENSE BLOCK *****
 * 
 * "The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Zindus Sync.
 * 
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

include("chrome://zindus/content/contactconverter.js");

function ZimbraAddressBook()
{
}

ZimbraAddressBook.kPABDirectory = 2; // == nsIAbDirectoryProperties.dirType ==> mork address book
                                     // see mozilla/mailnews/addrbook/...  src/nsDirPrefs.h and resources/content/addressbook.js

ZimbraAddressBook.getAddressBookUri = function(name)
{
	var functor =
	{
		run: function(elem)
		{
			if (elem.dirName == name)
				this.uri = elem.directoryProperties.URI;
			else
				this.uri = null;
		
			return this.uri == null;
		}
	};

	ZimbraAddressBook.forEachAddressBook(functor);

	return functor.uri;
}

ZimbraAddressBook.getAddressBookPrefId = function(uri)
{
	var rdf  = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir  = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	return dir.dirPrefId;
}

ZimbraAddressBook.forEachAddressBook = function(functor)
{
	var rdf   = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var root  = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var nodes = root.childNodes;
	var fContinue = true;

	while (nodes.hasMoreElements() && fContinue)
	{
		var elem = nodes.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);

		fContinue = functor.run(elem);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

ZimbraAddressBook.forEachCard = function(uri, functor)
{
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var enm = dir.childCards;
	var fContinue = true;

	try { enm.first() } catch(ex) { fContinue = false; }

	while (fContinue)
	{
		var item = enm.currentItem();

		fContinue = functor.run(uri, item);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		try { enm.next(); } catch(ex) { fContinue = false; }
	}
}

ZimbraAddressBook.contactPropertyChecksum = function(properties)
{
	var i, j, length;
	var charcount = 1;
	var checksum = 0;

	for (i in properties)
	{
		length = properties[i].length;

		for (j = 0; j < length; j++)
		{
			var tmp = checksum;
			checksum = (checksum + ((charcount % 10) * properties[i].charCodeAt(j))) % Number.MAX_VALUE;
			charcount++;
		}
	}

	return checksum;
}

ZimbraAddressBook.instanceAbook = function()
{
	return Components.classes["@mozilla.org/addressbook;1"].createInstance(Components.interfaces.nsIAddressBook);
}

ZimbraAddressBook.newAbDirectoryProperties = function(name)
{
	var abProps = Components.classes["@mozilla.org/addressbook/properties;1"].
	                createInstance(Components.interfaces.nsIAbDirectoryProperties);

	abProps.description = name;
	abProps.dirType     = ZimbraAddressBook.kPABDirectory;

	return abProps;
}

ZimbraAddressBook.newAddressBook = function(name)
{
	abProps = ZimbraAddressBook.newAbDirectoryProperties(name);
	ZimbraAddressBook.instanceAbook().newAddressBook(abProps);
	return abProps.URI;
}

ZimbraAddressBook.deleteAddressBook = function(uri)
{
	var rdf  = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir  = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = rdf.GetDataSource("rdf:addressdirectory");

	var arrayDir  = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	var arrayRoot = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);

	arrayDir.AppendElement(dir);
	arrayRoot.AppendElement(root);

	ZimbraAddressBook.instanceAbook().deleteAddressBooks(ds, arrayRoot, arrayDir);
}

ZimbraAddressBook.renameAddressBook = function(uri, name)
{
	var rdf  = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir  = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = rdf.GetDataSource("rdf:addressdirectory");

	ZimbraAddressBook.instanceAbook().modifyAddressBook(ds, root, dir, ZimbraAddressBook.newAbDirectoryProperties(name));
}

ZimbraAddressBook.deleteCards = function(uri, cardsArray)
{
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	dir.deleteCards(cardsArray);
}

// ZimbraAddressBook.moveCard = function(uri_to, abCard)
// {
//	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
//	var dir = rdf.GetResource(uri_to).QueryInterface(Components.interfaces.nsIAbDirectory);
//	dir.dropCard(abCard, false);
// }

ZimbraAddressBook.addCard = function(uri, format, standard, extras)
{
	zinAssert(uri != null && isPropertyPresent(CnsContactConverter.instance().m_map, format) && standard != null && extras != null);

	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abstractCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].
	                      createInstance().QueryInterface(Components.interfaces.nsIAbCard);
	var realCard = dir.addCard(abstractCard);

	ZimbraAddressBook.updateCard(realCard, uri, format, standard, extras);

	return realCard;
}

ZimbraAddressBook.updateCard = function(abCard, uri, format, standard, extras)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var i, j, key;
	var thunderbird_properties;

	var lastModifiedDatePre = abCard.lastModifiedDate;

	if (format != FORMAT_TB)
		thunderbird_properties =  CnsContactConverter.instance().convert(FORMAT_TB, format, standard);
	else
		thunderbird_properties = standard;
	
	for (i in thunderbird_properties)
	{
		j   = CnsContactConverter.instance().m_map[FORMAT_TB][i];    zinAssert(typeof j != 'undefined');
		key = CnsContactConverter.instance().m_equivalents[j][FORMAT_TB]; zinAssert(key != null);

		abCard.setCardValue(i, thunderbird_properties[i]);

		// logger.debug("ZimbraAddressBook.addCard() - i == " + i + " and j == " + j);
		// logger.debug("ZimbraAddressBook.addCard() calls abCard.setCardValue(" + i + ", " + thunderbird_properties[i] + ")");
	}

	for (i in extras)
	{
		mdbCard.setStringAttribute(i, extras[i]);
		// logger.debug("ZimbraAddressBook.addCard() calls mdbCard.setStringAttribute(" + i + ", " + extras[i] + ")");
	}

	mdbCard.editCardToDatabase(uri);

	// confirm that callers can rely on the .lastModifiedDate property changing after an update
	// ie that they don't have to do a lookup after an update
	//
	zinAssert(lastModifiedDatePre != abCard.lastModifiedDate);

	return abCard;
}

ZimbraAddressBook.getCardProperties = function(abCard, format)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var i, j, key, value;
	var ret = new Object();

	for (i in CnsContactConverter.instance().m_map[FORMAT_TB])
	{
		value = abCard.getCardValue(i);

		if (value)
		{
			if (format == FORMAT_TB)
				ret[i] = value;
			else
			{
				j = CnsContactConverter.instance().m_map[FORMAT_TB][i];
				zinAssert(typeof j != 'undefined');
				key = CnsContactConverter.instance().m_equivalents[j][format];

				if (key != null)
					ret[key] = value;
			}
		}
	}

	return ret;
}

ZimbraAddressBook.getCardAttributes = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var ret     = new Object();
	var i, value;

	var attributes = [ TBCARD_ATTRIBUTE_LUID, TBCARD_ATTRIBUTE_CHECKSUM ];

	for (i = 0; i < attributes.length; i++)
	{
		value = mdbCard.getStringAttribute(attributes[i]);

		if (value)
			ret[attributes[i]] = value;
	}

	return ret;
}

ZimbraAddressBook.lookupCard = function(uri, key, value)
{
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abCard = ZimbraAddressBook.instanceAbook().getAbDatabaseFromURI(uri).getCardFromAttribute(dir, key, value, false);

	return abCard; // an nsIABCard
}

ZimbraAddressBook.nsIAbCardToPrintable = function(abCard)
{
	return (abCard.isMailList ? abCard.mailListURI : abCard.getCardValue("PrimaryEmail"));
}

ZimbraAddressBook.nsIAbMDBCardToKey = function(uri, mdbCard)
{
	zinAssert(typeof(uri) == 'string' && typeof(mdbCard) == 'object' && uri != null && mdbCard != null);

	return uri + "-" + mdbCard.dbTableID + "-" + mdbCard.dbRowID + "-" + mdbCard.key;
}

