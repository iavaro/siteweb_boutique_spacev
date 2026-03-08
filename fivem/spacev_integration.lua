
--[[
    SpaceV FiveM Integration
    ========================
    This script integrates your FiveM server with the SpaceV platform.
    It handles anti-cheat monitoring, player stats, inventory sync, and more.
    
    Installation:
    1. Add this script to your server resources
    2. Configure the API settings below
    3. Add the necessary event handlers in your base script
    
    @author SpaceV
    @version 1.0.0
]]

-- Configuration
SpaceV = {}
SpaceV.Config = {
    -- API Configuration
    apiUrl = "http://localhost:3000",  -- Change to your SpaceV URL
    apiKey = "your-fivem-api-key",    -- Get this from admin panel
    
    -- Sync Intervals (in milliseconds)
    statsInterval = 60000,            -- Sync stats every 60 seconds
    inventoryInterval = 30000,         -- Sync inventory every 30 seconds
    heartbeatInterval = 300000,        -- Send heartbeat every 5 minutes
    
    -- Feature Toggles
    enableAnticheat = true,
    enableStatsSync = true,
    enableInventorySync = true,
    enableLeaderboards = true,
    
    -- Anti-Cheat Settings
    anticheatSettings = {
        moneyThreshold = 100000,       -- Alert if money gained exceeds this
        itemDuplicationCheck = true,
        speedHackCheck = true,
        teleportCheck = true,
    }
}

-- Player data storage
SpaceV.Players = {}
SpaceV.LastPositions = {}

-- Utility Functions
function SpaceV:Debug(msg)
    if GetConvar('spacev_debug', 'false') == 'true' then
        print('[SpaceV Debug] ' .. msg)
    end
end

function SpaceV:ApiRequest(endpoint, method, data)
    local url = self.Config.apiUrl .. endpoint
    
    local headers = {
        ['Content-Type'] = 'application/json',
        ['X-FiveM-Api-Key'] = self.Config.apiKey
    }
    
    local payload = json.encode(data)
    
    self:Debug('API Request: ' .. method .. ' ' .. url)
    
    PerformHttpRequest(url, function(statusCode, response)
        if statusCode == 200 then
            local result = json.decode(response)
            if result then
                self:Debug('API Response: ' .. response)
            end
        else
            self:Debug('API Error: ' .. statusCode .. ' - ' .. response)
        end
    end, method, payload, headers)
end

function SpaceV:GetPlayerIdentifiers(source)
    local identifiers = {}
    local player = GetPlayer(source)
    
    for i = 0, GetNumPlayerIdentifiers(source) - 1 do
        local identifier = GetPlayerIdentifier(source, i)
        local idType = identifier:match("([^:]+):")
        identifiers[idType] = identifier
    end
    
    return identifiers
end

function SpaceV:GetPlayerLicense(source)
    local identifiers = self:GetPlayerIdentifiers(source)
    return identifiers.license or "unknown"
end

-- Player Management
function SpaceV:RegisterPlayer(source)
    local identifiers = self:GetPlayerIdentifiers(source)
    local license = self:GetPlayerLicense(source)
    local name = GetPlayerName(source)
    
    local data = {
        license = license,
        playerName = name,
        identifiers = {
            discordId = identifiers.discord,
            steamId = identifiers.steam,
            liveId = identifiers.live,
            xboxId = identifiers.xbl
        }
    }
    
    self:ApiRequest('/api/fivem/player/identify', 'POST', data)
    
    self.Players[source] = {
        license = license,
        name = name,
        identifiers = identifiers,
        lastSync = os.time()
    }
end

-- Anti-Cheat Functions
function SpaceV:LogAnticheatEvent(source, eventType, value, details)
    if not self.Config.enableAnticheat then return end
    
    local player = self.Players[source]
    if not player then return end
    
    local data = {
        playerName = player.name,
        license = player.license,
        event = eventType,
        value = value,
        details = details or {},
        evidence = json.encode({
            source = source,
            ped = PlayerPedId(source),
            coords = GetEntityCoords(PlayerPedId(source)),
            timestamp = os.date('%Y-%m-%dT%H:%M:%SZ')
        })
    }
    
    self:ApiRequest('/api/fivem/anticheat', 'POST', data)
    
    -- Local notification
    print('[SpaceV Anti-Cheat] ' .. eventType .. ' - ' .. player.name .. ' - Value: ' .. tostring(value))
end

-- Money Exploit Detection
function SpaceV:CheckMoneyExploit(source, newMoney, oldMoney)
    if not self.Config.enableAnticheat then return end
    
    local threshold = self.Config.anticheatSettings.moneyThreshold
    local diff = newMoney - oldMoney
    
    if diff > threshold then
        self:LogAnticheatEvent(source, 'MONEY_EXPLOIT', diff, {
            oldMoney = oldMoney,
            newMoney = newMoney,
            difference = diff
        })
    end
end

-- Speed Hack Detection
local lastSpeedCheck = {}
function SpaceV:CheckSpeedHack(source)
    if not self.Config.anticheatSettings.speedHackCheck then return end
    
    local ped = PlayerPedId(source)
    local vehicle = GetVehiclePedIsIn(ped, false)
    
    if vehicle ~= 0 then
        local speed = GetEntitySpeed(vehicle) * 3.6 -- Convert to km/h
        local maxSpeed = 200 -- Adjust based on your server
        
        if speed > maxSpeed then
            self:LogAnticheatEvent(source, 'SPEED_HACK', speed, {
                vehicle = vehicle,
                maxSpeed = maxSpeed
            })
        end
    end
end

-- Teleport Detection
function SpaceV:CheckTeleportHack(source)
    if not self.Config.anticheatSettings.teleportCheck then return end
    
    local player = self.Players[source]
    if not player then return end
    
    local ped = PlayerPedId(source)
    local currentPos = GetEntityCoords(ped)
    
    if self.LastPositions[source] then
        local lastPos = self.LastPositions[source]
        local distance = #(currentPos - lastPos)
        
        -- If moved more than 100 meters in 1 second (normal movement is ~15m/s)
        if distance > 100 then
            self:LogAnticheatEvent(source, 'TELEPORT_HACK', distance, {
                from = lastPos,
                to = currentPos
            })
        end
    end
    
    self.LastPositions[source] = currentPos
end

-- Stats Sync
function SpaceV:SyncPlayerStats(source)
    if not self.Config.enableStatsSync then return end
    
    local player = self.Players[source]
    if not player then return end
    
    -- Get player data (adjust based on your framework - ESX/QBCore)
    local money = 0
    local bank = 0
    local job = "unemployed"
    local jobGrade = 0
    local playtime = 0
    
    -- ESX Example
    if ESX then
        local xPlayer = ESX.GetPlayerFromId(source)
        if xPlayer then
            money = xPlayer.getMoney()
            bank = xPlayer.getAccount('bank').money
            job = xPlayer.job.name
            jobGrade = xPlayer.job.grade
        end
    end
    
    -- QBCore Example
    if QBCore then
        local Player = QBCore.Functions.GetPlayer(source)
        if Player then
            money = Player.PlayerData.money.cash
            bank = Player.PlayerData.money.bank
            job = Player.PlayerData.job.name
            jobGrade = Player.PlayerData.job.grade
        end
    end
    
    local data = {
        license = player.license,
        playerName = player.name,
        stats = {
            money = money,
            bank = bank,
            playtime = playtime
        }
    }
    
    self:ApiRequest('/api/fivem/player/update-stats', 'POST', data)
    
    -- Sync job
    local jobData = {
        license = player.license,
        job = job,
        jobGrade = jobGrade,
        jobLabel = job,
        onDuty = true,
        salary = 0
    }
    
    self:ApiRequest('/api/fivem/player/job', 'POST', jobData)
    
    player.lastSync = os.time()
end

-- Inventory Sync
function SpaceV:SyncPlayerInventory(source)
    if not self.Config.enableInventorySync then return end
    
    local player = self.Players[source]
    if not player then return end
    
    local items = {}
    
    -- ESX Example
    if ESX then
        local xPlayer = ESX.GetPlayerFromId(source)
        if xPlayer then
            local inventory = xPlayer.inventory
            for _, item in ipairs(inventory) do
                if item.count > 0 then
                    table.insert(items, {
                        name = item.name,
                        label = item.label,
                        count = item.count
                    })
                end
            end
        end
    end
    
    -- QBCore Example
    if QBCore then
        local Player = QBCore.Functions.GetPlayer(source)
        if Player then
            local inventory = Player.PlayerData.items
            for _, item in ipairs(inventory) do
                if item and item.amount > 0 then
                    table.insert(items, {
                        name = item.name,
                        label = item.label,
                        count = item.amount
                    })
                end
            end
        end
    end
    
    local data = {
        license = player.license,
        items = items
    }
    
    self:ApiRequest('/api/fivem/player/inventory', 'POST', data)
end

-- Heartbeat
function SpaceV:SendHeartbeat()
    local data = {
        serverName = GetConvar('sv_serverName', 'FiveM Server'),
        onlinePlayers = #GetActivePlayers(),
        maxPlayers = GetConvarInt('sv_maxClients', 32)
    }
    
    self:ApiRequest('/api/fivem/server/heartbeat', 'POST', data)
end

-- Event Handlers

-- Player Joined
AddEventHandler('playerJoining', function()
    local source = source
    SpaceV:RegisterPlayer(source)
end)

-- Player Dropped
AddEventHandler('playerDropped', function(reason)
    local source = source
    SpaceV.Players[source] = nil
    SpaceV.LastPositions[source] = nil
end)

-- Money Change (ESX Example)
AddEventHandler('esx:playerLoaded', function(source)
    SpaceV:RegisterPlayer(source)
end)

-- Update money (call this from your money handling code)
function SpaceV:OnMoneyChange(source, newMoney, oldMoney)
    self:CheckMoneyCheck(source, newMoney, oldMoney)
end

--[[
    Call these functions from your server scripts:
    
    1. Anti-Cheat Events:
    TriggerEvent('spacev:anticheat', source, 'ITEM_DUPLICATION', 100, {item = 'weapon'})
    
    2. Stats Update (after changes):
    TriggerEvent('spacev:updateStats', source)
    
    3. Inventory Update:
    TriggerEvent('spacev:updateInventory', source)
]]

-- Anti-Cheat Event Handler
RegisterNetEvent('spacev:anticheat')
AddEventHandler('spacev:anticheat', function(source, eventType, value, details)
    SpaceV:LogAnticheatEvent(source, eventType, value, details)
end)

-- Stats Update Event
RegisterNetEvent('spacev:updateStats')
AddEventHandler('spacev:updateStats', function(source)
    SpaceV:SyncPlayerStats(source)
end)

-- Inventory Update Event
RegisterNetEvent('spacev:updateInventory')
AddEventHandler('spacev:updateInventory', function(source)
    SpaceV:SyncPlayerInventory(source)
end)

-- Create tick handlers for continuous checks
CreateThread(function()
    while true do
        Wait(1000)
        
        -- Check speed and teleport for all players
        for _, player in ipairs(GetActivePlayers()) do
            SpaceV:CheckSpeedHack(player)
            SpaceV:CheckTeleportHack(player)
        end
    end
end)

-- Periodic sync (adjust intervals in config)
CreateThread(function()
    while true do
        Wait(SpaceV.Config.statsInterval)
        
        for _, player in ipairs(GetActivePlayers()) do
            SpaceV:SyncPlayerStats(player)
        end
    end
end)

CreateThread(function()
    while true do
        Wait(SpaceV.Config.inventoryInterval)
        
        for _, player in ipairs(GetActivePlayers()) do
            SpaceV:SyncPlayerInventory(player)
        end
    end
end)

CreateThread(function()
    while true do
        Wait(SpaceV.Config.heartbeatInterval)
        SpaceV:SendHeartbeat()
    end
end)

-- Server startup
print('[SpaceV] FiveM Integration loaded successfully!')
print('[SpaceV] API URL: ' .. SpaceV.Config.apiUrl)

-- Export functions for use in other scripts
exports('getPlayerData', function(source)
    return SpaceV.Players[source]
end)

exports('logAnticheat', function(source, eventType, value, details)
    SpaceV:LogAnticheatEvent(source, eventType, value, details)
end)

