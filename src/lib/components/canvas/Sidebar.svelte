<script lang="ts">
    import { Brain, Grid, Calendar, Settings, ChevronRight } from 'lucide-svelte';
    import {
      Sidebar,
      SidebarContent,
      SidebarHeader,
      SidebarFooter,
      SidebarGroup,
      SidebarGroupContent,
      SidebarMenu,
      SidebarMenuItem,
      SidebarMenuButton,
      SidebarMenuSub
    } from '$lib/components/ui/sidebar';

    let expandedItems = new Set();

    function toggleExpand(item) {
      if (expandedItems.has(item)) {
        expandedItems.delete(item);
      } else {
        expandedItems.add(item);
      }
      expandedItems = expandedItems; // Trigger reactivity
    }
  </script>
  
<Sidebar class="w-64 bg-gray-100">
  <SidebarHeader>
    <div class="flex items-center gap-2">
      <Brain class="w-6 h-6 text-blue-500" />
      <span class="text-lg font-semibold">KnowledgeCanvas</span>
    </div>
  </SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton on:click={() => toggleExpand('Design')}>
              <ChevronRight class="w-4 h-4 {expandedItems.has('Design') ? 'rotate-90' : ''} transition-transform" />
              Design
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton on:click={() => toggleExpand('AI/ML')}>
              <ChevronRight class="w-4 h-4 {expandedItems.has('AI/ML') ? 'rotate-90' : ''} transition-transform" />
              AI/ML
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton on:click={() => toggleExpand('JPL')}>
              <ChevronRight class="w-4 h-4 {expandedItems.has('JPL') ? 'rotate-90' : ''} transition-transform" />
              JPL
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton on:click={() => toggleExpand('UCLA')}>
              <ChevronRight class="w-4 h-4 {expandedItems.has('UCLA') ? 'rotate-90' : ''} transition-transform" />
              UCLA
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton isActive={true} on:click={() => toggleExpand('Knowledge')}>
              <ChevronRight class="w-4 h-4 rotate-90 transition-transform" />
              Knowledge
            </SidebarMenuButton>
            {#if expandedItems.has('Knowledge')}
              <SidebarMenuSub>
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm">Dependencies</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm">Sources</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm">Inspiration</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm">Development</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenuSub>
            {/if}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>

  <SidebarFooter>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton>
          <Grid class="w-4 h-4" />
          Projects
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton>
          <Calendar class="w-4 h-4" />
          Calendar
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton>
          <Settings class="w-4 h-4" />
          Settings
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</Sidebar>