/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/*
Description.. :	Functions for implementing context menu
Author....... :	DC
Date......... : 2023-10-27
*/
const DEFAULT = "";
const ADD_TAB_PAGE = "Add Tab Page|images/designer/edit_add.png";
const ADD_LINKBAR_GROUP = "Add LinkBar Group|images/designer/edit_add.png";
const ADD_LINKBAR_ITEM = "Add LinkBar Item|images/designer/edit_add.png";

// extends a context menu with base functionality
function ApplyContextMenu()
{
	if(selectedControl instanceof TabControl)
	{
        selectedControl.EnableContextMenu = true;
        var oMenu = selectedControl.ContextMenu;
        if(!oMenu)
        {
            oMenu = new Menu();
            selectedControl.ContextMenu = oMenu;
            __addItem(oMenu, form.Resources[ADD_TAB_PAGE], "__add_tab_page");
        }
    }

	if(selectedControl instanceof LinkBarGroup)
	{
		selectedControl.EnableContextMenu = true;
		var oMenu = selectedControl.ContextMenu;
		if(!oMenu)
		{
			oMenu = new Menu();
			selectedControl.ContextMenu = oMenu;
			__addItem(oMenu, form.Resources[ADD_LINKBAR_ITEM], "__add_linkbar_item");
		}
	}

	// if(selectedControl instanceof LinkBar)
	// {
	// 	selectedControl.EnableContextMenu = true;
	// 	var oMenu = selectedControl.ContextMenu;
	// 	if(!oMenu)
	// 	{
	// 		oMenu = new Menu();
	// 		selectedControl.ContextMenu = oMenu;
	// 		__addItem(oMenu, form.Resources[ADD_LINKBAR_GROUP], "__add_linkbar_group");
	// 	}
	// }

	// handle events
	if(_treePanel.OnContextMenuClick)
	{
		if(!_treePanel.OnContextMenuClick.name !== "_newOnContextMenuClick")
		{
			let aux = _treePanel.OnContextMenuClick;
			_treePanel.OnContextMenuClick = function _newOnContextMenuClick(sender, eventArgs) {
				if (!__base_menu_OnContextMenuClick(sender, eventArgs))
					aux(sender, eventArgs);
			};
		}
	}
	else
		_treePanel.OnContextMenuClick = __base_menu_OnContextMenuClick;
	
	if (_treePanel.OnContextMenuPopup)
	{
		if (!_treePanel.OnContextMenuPopup.name !== "_newContextMenuPopup")
		{
			let aux = _treePanel.OnContextMenuPopup;
			_treePanel.OnContextMenuPopup = function _newContextMenuPopup(sender, eventArgs) {
				aux(sender, eventArgs);
				__base_menu_OnContextMenuPopup(sender, eventArgs);
			};
		}
	}
	else
		_treePanel.OnContextMenuPopup = "__base_menu_OnContextMenuPopup(sender, eventArgs)";
}

function __findByText(oMenu, sText, aAlternateTexts)
{
	var aTexts = aAlternateTexts;
	if(!aTexts)
		aTexts = [];

	aTexts.push(sText);
	for(let i of oMenu.Items)
		for(let j of aTexts)
			if(i.Text == aTexts[j])
				return i;

	return null;
}

function __addItem(oMenu, sText, sFunction, bAllowDuplicates, aAlternateTexts, sGroup, enabled = true)
{
	var sImage;
	if(sText.includes("|"))
	{
		var aText = sText.split('|');
		sText = aText[0];
		sImage = aText[1];
	}
	else
		sImage = form.Resources[DEFAULT];

	if(!bAllowDuplicates && __findByText(oMenu, sText, aAlternateTexts))
		return null;

	var oParent = oMenu;
	if(sGroup)
	{
		oParent = __findByText(oMenu, sGroup, []);
		if(!oParent)
		{
			oParent = new MenuItem();	
			oParent.Id = sGroup;
			oParent.Text = sGroup;
			oMenu.Items.Add(oParent);
		}
		if(!bAllowDuplicates && __findByText(oParent, sText, aAlternateTexts))
			return null;
	}
	
	if(!oParent)
		oParent = oMenu;

	var oItem = new MenuItem();	
	oItem.Id = sText;
	oItem.Text = sText;
	oItem.Tag = {sFunction: sFunction};
	oItem.Enabled = enabled;
	oItem.icon = sImage;
	oParent.Items.Add(oItem); 
	return oItem;
}

function __add_separator(oMenu)
{
	var oItem = new MenuSeparator();
	oMenu.Items.Add(oItem); 
	return oItem;
}

function __add_header(oMenu, sText)
{
	var oItem = new MenuHeader();
	oItem.Text = sText;
	oMenu.Items.Add(oItem);
	return oItem;
}

function __base_menu_OnContextMenuClick(sender, eventArgs)
{
	event.preventDefault();
	var bHandled = false;
	var oMenuItem = eventArgs["Menu"];

    // differentiate from menu items from CreateAuditContextMenuEx
	if(oMenuItem.Tag && oMenuItem.Tag.sFunction && !oMenuItem.Tag.IsBase) 
	{
		try
		{
			form.DisplayWaitMessage(true, "Loading...");
			form.ExecFunction(oMenuItem.Tag.sFunction, [sender, eventArgs]);
		}
		finally
		{
			form.DisplayWaitMessage(false);
		}
		return true;
	}
	return bHandled;
}

function __base_menu_OnContextMenuPopup(sender, eventArgs)
{
    event.preventDefault();
}
