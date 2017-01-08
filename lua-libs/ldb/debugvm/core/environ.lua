local class = require('ldb/utils/oo').class
local aux = require('ldb/debugvm/aux')

local Environ = class({

    constructor = function(self)
        self.aux = aux
        self.locals_array_cache = {}
        self.locals_dict_cache = {}
        self.mask_chars = ''
    end,

    get_locals_array = function(self, level, event)
        local key = string.format('%s:%d', event, level)
        local value = self.locals_array_cache[key]
        if value ~= nil then
            return value or nil
        end

        value = aux.get_locals_array(level, event)
        self.locals_array_cache[key] = value or false
        return value
    end,

    get_locals_dict = function(self, level, event)
        local key = string.format('%s:%d', event, level)
        local value = self.locals_dict_cache[key]
        if value ~= nil then
            return value or nil
        end

        value = aux.get_locals_dict(level, event)
        self.locals_dict_cache[key] = value or false
        return value
    end,

    get_upvalues_dict = function(self, level)
        return aux.get_upvalues_dict(level)
    end,

    get_stack = function(self, level)
        return aux.get_stack(level)
    end,

    get_stacks = function(self)
        local stacks = {}
        local i = 1
        while true do
            local stack = self:get_stack(i)
            if stack == nil then
                break
            end
            table.insert(stacks, stack)
            i = i + 1
        end
        return stacks
    end,

    get_step = function(self, event)
        return aux.get_step(event)
    end,

    require_mask = function(self, mask)
        self.mask_chars = self.mask_chars .. mask
    end,

})

return {
    Environ = Environ,
}
